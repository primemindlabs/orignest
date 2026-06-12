/**
 * Phase 38 follow-up — privacy preferences.
 *   GET   → current analytics_opt_out + deletion_requested_at.
 *   PATCH → set analytics opt-out ({ analytics_opt_out: boolean }).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function profileFor(userId: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('profiles')
    .select('id, analytics_opt_out, deletion_requested_at')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  return data;
}

export async function GET() {
  const { userId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const p = await profileFor(userId);
  if (!p) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  return NextResponse.json({
    analytics_opt_out: p.analytics_opt_out ?? false,
    deletion_requested_at: p.deletion_requested_at ?? null,
  });
}

export async function PATCH(req: Request) {
  const { userId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { analytics_opt_out?: boolean };
  if (typeof body.analytics_opt_out !== 'boolean') {
    return NextResponse.json({ error: 'analytics_opt_out (boolean) is required' }, { status: 400 });
  }
  const p = await profileFor(userId);
  if (!p) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const sb = createAdminClient();
  await sb.from('profiles').update({ analytics_opt_out: body.analytics_opt_out }).eq('id', p.id);
  return NextResponse.json({ ok: true, analytics_opt_out: body.analytics_opt_out });
}
