/**
 * Phase 30.7 — campaign draft actions (LO-only).
 *   PATCH { action: 'approve'|'skip'|'edit', email_subject?, email_body?, sms_message? }
 *   POST  { channel } → record a send (campaign_sends, INSERT-only) + mark draft sent.
 *
 * Actual email/SMS delivery is recorded here; wiring it to Resend/Relay/Twilio is
 * the remaining integration (gated on those provider keys). The reviewed queue +
 * send audit is fully functional.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function profileId(sb: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; email_subject?: string; email_body?: string; sms_message?: string };

  const sb = createAdminClient();
  const patch: Record<string, unknown> = { reviewed_by: await profileId(sb, userId), reviewed_at: new Date().toISOString() };
  if (body.action === 'approve') patch.status = 'approved';
  else if (body.action === 'skip') patch.status = 'skipped';
  if (typeof body.email_subject === 'string') patch.email_subject = body.email_subject;
  if (typeof body.email_body === 'string') patch.email_body = body.email_body;
  if (typeof body.sms_message === 'string') patch.sms_message = body.sms_message;

  const { error } = await sb.from('campaign_drafts').update(patch).eq('id', params.id).eq('org_id', orgId);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { channel?: string };
  const channel = ['email', 'sms', 'both'].includes(body.channel ?? '') ? (body.channel as string) : 'email';

  const sb = createAdminClient();
  const { data: draft } = await sb.from('campaign_drafts').select('id, status').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // TODO(delivery): dispatch via Resend (email) / Twilio (sms) when keys are set.
  // The send is recorded regardless so the audit trail is complete.
  const { error: sendErr } = await sb.from('campaign_sends').insert({
    draft_id: draft.id,
    org_id: orgId,
    sent_by: await profileId(sb, userId),
    channel,
  });
  if (sendErr) return NextResponse.json({ error: 'send_record_failed' }, { status: 500 });

  await sb.from('campaign_drafts').update({ status: 'sent', reviewed_by: await profileId(sb, userId), reviewed_at: new Date().toISOString() }).eq('id', draft.id);
  return NextResponse.json({ ok: true });
}
