// Phase 128 — approve all of today's pending Autopilot actions at once.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoProfile, todayStr } from '@/lib/autopilot/loContext';
import { approveAllPending } from '@/lib/autopilot/approveAction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  try {
    const { count, undoDeadline } = await approveAllPending(sb, profile.id, todayStr());
    return NextResponse.json({ ok: true, count, undoDeadline });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
