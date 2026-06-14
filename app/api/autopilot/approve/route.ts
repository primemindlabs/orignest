// Phase 128 — approve a single Autopilot action (opens the 5-minute undo window).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { approveAction } from '@/lib/autopilot/approveAction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { actionId } = (await req.json().catch(() => ({}))) as { actionId?: string };
  if (!actionId) return NextResponse.json({ error: 'actionId required' }, { status: 400 });

  const sb = createAdminClient();
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  try {
    const { undoDeadline } = await approveAction(sb, actionId, profile.id);
    return NextResponse.json({ ok: true, undoDeadline });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
