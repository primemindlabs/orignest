// Phase 104 — record that the LO reached out to the AE for an extension. Logs to
// ae_submission_log (Phase 89) and stamps the lock as 'requested'. The actual email/
// text is sent client-side via mailto:/sms:. Does NOT create an extension log row.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ leadId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { leadId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const aeConnectionId: string | null = body?.ae_connection_id ?? null;
  const messageText: string | null = body?.message_text ?? null;
  if (!aeConnectionId || !messageText) {
    return NextResponse.json({ error: 'ae_connection_id and message_text required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const loId = (profile?.id as string | undefined) ?? null;

  const { data: lead } = await sb
    .from('leads')
    .select('loan_amount, loan_type')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();

  // Best-effort submission record (ae_submission_log has no message body field).
  await sb.from('ae_submission_log').insert({
    org_id: orgId,
    ae_id: aeConnectionId,
    loan_id: leadId,
    lo_id: loId,
    loan_type: (lead?.loan_type as string | null) ?? null,
    loan_amount: lead?.loan_amount ?? null,
    submitted_at: new Date().toISOString(),
  });

  // Stamp the active lock as extension-requested.
  await sb
    .from('rate_lock_requests')
    .update({ extension_status: 'requested', extension_requested_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .not('status', 'in', '(cancelled,declined)');

  return NextResponse.json({ ok: true, sent_at: new Date().toISOString() });
}
