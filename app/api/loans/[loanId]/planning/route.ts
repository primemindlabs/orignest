/**
 * Phase 46.8/46.10 — loan planning fields: target/actual close date + the
 * referring realtor link. Linking a realtor fires 'referral_received'; setting a
 * target close date fires 'closing_scheduled' (both deduped + Twilio-gated).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordRealtorNotification } from '@/lib/realtors/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { target_close_date?: string | null; actual_close_date?: string | null; referral_realtor_id?: string | null };
  const sb = createAdminClient();
  const { data: before } = await sb.from('leads').select('referral_realtor_id, target_close_date').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('target_close_date' in b) patch.target_close_date = b.target_close_date || null;
  if ('actual_close_date' in b) patch.actual_close_date = b.actual_close_date || null;
  if ('referral_realtor_id' in b) patch.referral_realtor_id = b.referral_realtor_id || null;
  await sb.from('leads').update(patch).eq('id', params.loanId).eq('org_id', orgId);

  // Fire notifications for newly-set values (best-effort).
  if (b.referral_realtor_id && b.referral_realtor_id !== before.referral_realtor_id) {
    await recordRealtorNotification(params.loanId, 'referral_received', orgId).catch(() => undefined);
  }
  if (b.target_close_date && b.target_close_date !== before.target_close_date) {
    await recordRealtorNotification(params.loanId, 'closing_scheduled', orgId).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
