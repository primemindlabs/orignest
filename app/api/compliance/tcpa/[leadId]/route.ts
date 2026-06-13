// Phase 116 — LO updates a contact's communication preferences (logged immutably).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ leadId: string }> };
const BOOL_FIELDS = ['sms_opted_in', 'email_opted_in', 'voicemail_opted_in', 'sms_loan_updates', 'sms_reminders', 'sms_marketing'];
const TEXT_FIELDS = ['contact_time_start', 'contact_time_end', 'contact_timezone'];

export async function PATCH(request: Request, { params }: Ctx) {
  const { leadId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const sb = createAdminClient();

  const { data: lead } = await sb.from('leads').select('id, assigned_to').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const patch: Record<string, unknown> = { org_id: orgId, lead_id: leadId, lo_id: lead.assigned_to ?? profile?.id ?? null, updated_at: new Date().toISOString() };
  for (const f of BOOL_FIELDS) if (body[f] !== undefined) patch[f] = !!body[f];
  for (const f of TEXT_FIELDS) if (body[f] !== undefined) patch[f] = String(body[f]);

  const { data, error } = await sb
    .from('communication_preferences')
    .upsert(patch, { onConflict: 'org_id,lead_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('consent_audit_log').insert({
    org_id: orgId,
    lead_id: leadId,
    lo_id: profile?.id ?? null,
    event_type: 'lo_manual_update',
    channel: 'portal',
    source: 'lo_manual',
    consent_text: 'Loan officer updated communication preferences',
    new_value: JSON.stringify(Object.fromEntries(Object.entries(patch).filter(([k]) => ![ 'org_id', 'lead_id', 'lo_id', 'updated_at'].includes(k)))),
  });

  return NextResponse.json({ preferences: data });
}
