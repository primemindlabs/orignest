// Phase 116 — LO Compliance Snapshot: per-contact SMS/email opt-in status, hours, and
// last consent event. Org-scoped (read-only view).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ contacts: [] });

  const sb = createAdminClient();
  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, phone, email, sms_consent, last_contacted_at')
    .eq('org_id', orgId)
    .not('phone', 'is', null)
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .limit(200);

  const ids = (leads ?? []).map((l) => l.id as string);
  const phones = (leads ?? []).map((l) => l.phone).filter(Boolean) as string[];

  const optedOut = new Set<string>();
  const prefByLead = new Map<string, any>();
  const lastEventByLead = new Map<string, any>();
  if (ids.length) {
    const [{ data: oo }, { data: prefs }, { data: events }] = await Promise.all([
      phones.length ? sb.from('sms_opt_outs').select('phone').eq('org_id', orgId).in('phone', phones) : Promise.resolve({ data: [] as any[] }),
      sb.from('communication_preferences').select('*').eq('org_id', orgId).in('lead_id', ids),
      sb.from('consent_audit_log').select('lead_id, event_type, occurred_at').eq('org_id', orgId).in('lead_id', ids).order('occurred_at', { ascending: false }),
    ]);
    for (const o of oo ?? []) optedOut.add(o.phone as string);
    for (const p of prefs ?? []) prefByLead.set(p.lead_id as string, p);
    for (const e of events ?? []) if (!lastEventByLead.has(e.lead_id as string)) lastEventByLead.set(e.lead_id as string, e);
  }

  const contacts = (leads ?? []).map((l) => {
    const pref = prefByLead.get(l.id as string);
    const isOptedOut = !!l.phone && optedOut.has(l.phone as string);
    const last = lastEventByLead.get(l.id as string);
    return {
      lead_id: l.id,
      name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Contact',
      phone: l.phone,
      email: l.email,
      sms_status: isOptedOut ? 'opted_out' : l.sms_consent ? (pref ? (pref.sms_opted_in ? 'opted_in' : 'off') : 'consented') : 'never_set',
      email_opted_in: pref ? pref.email_opted_in : true,
      contact_hours: pref ? `${(pref.contact_time_start as string).slice(0, 5)}–${(pref.contact_time_end as string).slice(0, 5)} ${pref.contact_timezone}` : null,
      categories: pref
        ? { loan_updates: pref.sms_loan_updates, reminders: pref.sms_reminders, marketing: pref.sms_marketing }
        : null,
      last_event: last ? { event_type: last.event_type, occurred_at: last.occurred_at } : null,
    };
  });

  return NextResponse.json({ contacts });
}
