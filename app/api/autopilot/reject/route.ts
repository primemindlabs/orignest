// Phase 128 — reject a recommended action with optional feedback.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { rejectAction } from '@/lib/autopilot/rejectAction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { actionId, reason } = (await req.json().catch(() => ({}))) as { actionId?: string; reason?: string };
  if (!actionId) return NextResponse.json({ error: 'actionId required' }, { status: 400 });

  const sb = createAdminClient();
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  try {
    await rejectAction(sb, actionId, profile.id, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
