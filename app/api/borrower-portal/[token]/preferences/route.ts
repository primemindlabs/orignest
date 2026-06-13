// Phase 116 — borrower self-service communication preferences (token-gated; the
// portal has no login). GET current prefs; PATCH writes prefs + an immutable consent
// audit row (source 'portal', with IP).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BOOL_FIELDS = ['sms_opted_in', 'email_opted_in', 'sms_loan_updates', 'sms_reminders', 'sms_marketing'];
const TEXT_FIELDS = ['contact_time_start', 'contact_time_end', 'contact_timezone'];

async function resolve(sb: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await sb.from('borrower_portal_tokens').select('lead_id, org_id, expires_at').eq('token', token).maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return data as { lead_id: string; org_id: string };
}

const DEFAULTS = {
  sms_opted_in: false,
  email_opted_in: true,
  sms_loan_updates: true,
  sms_reminders: true,
  sms_marketing: false,
  contact_time_start: '09:00',
  contact_time_end: '20:00',
  contact_timezone: 'America/New_York',
};

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const portal = await resolve(sb, params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });

  const { data: prefs } = await sb
    .from('communication_preferences')
    .select('*')
    .eq('org_id', portal.org_id)
    .eq('lead_id', portal.lead_id)
    .maybeSingle();
  return NextResponse.json({ preferences: prefs ?? DEFAULTS });
}

export async function PATCH(req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const portal = await resolve(sb, params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { org_id: portal.org_id, lead_id: portal.lead_id, updated_at: new Date().toISOString() };
  for (const f of BOOL_FIELDS) if (body[f] !== undefined) patch[f] = !!body[f];
  for (const f of TEXT_FIELDS) if (body[f] !== undefined) patch[f] = String(body[f]);

  const { data, error } = await sb
    .from('communication_preferences')
    .upsert(patch, { onConflict: 'org_id,lead_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'Could not save preferences' }, { status: 500 });

  // Keep the legacy SMS-consent flag in sync so other gates honor the choice.
  if (body.sms_opted_in !== undefined) {
    await sb.from('leads').update({ sms_consent: !!body.sms_opted_in }).eq('id', portal.lead_id).eq('org_id', portal.org_id).then(() => undefined, () => undefined);
    if (!body.sms_opted_in) {
      const { data: lead } = await sb.from('leads').select('phone').eq('id', portal.lead_id).maybeSingle();
      if (lead?.phone) await sb.from('sms_opt_outs').insert({ org_id: portal.org_id, lead_id: portal.lead_id, phone: lead.phone, source: 'portal_preferences' }).then(() => undefined, () => undefined);
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  await sb.from('consent_audit_log').insert({
    org_id: portal.org_id,
    lead_id: portal.lead_id,
    event_type: 'preference_update',
    channel: 'portal',
    source: 'portal',
    ip_address: ip,
    user_agent: req.headers.get('user-agent') ?? null,
    consent_text: 'Borrower updated communication preferences in the portal',
    new_value: JSON.stringify(Object.fromEntries(Object.entries(patch).filter(([k]) => !['org_id', 'lead_id', 'updated_at'].includes(k)))),
  });

  return NextResponse.json({ preferences: data });
}
