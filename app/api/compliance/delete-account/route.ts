/**
 * Phase 38 follow-up — CCPA right-to-delete (soft-delete).
 * POST: logs an immutable deletion request and stamps the profile with
 * deletion_requested_at. The actual data purge runs on a grace-period schedule;
 * this records the request and deactivates the account self-service.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const now = new Date().toISOString();
  await sb.from('account_deletion_requests').insert({
    org_id: orgId ?? null,
    requested_by: profile.id,
    reason: body.reason?.slice(0, 1000) ?? null,
    status: 'pending',
  });
  await sb.from('profiles').update({ deletion_requested_at: now }).eq('id', profile.id);

  return NextResponse.json({
    ok: true,
    deletion_requested_at: now,
    message: 'Your account deletion request has been recorded. Your data will be removed within 30 days per our retention policy.',
  });
}
