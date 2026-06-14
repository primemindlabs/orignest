// Phase 128 — last 30 days of Autopilot actions and their outcomes.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoProfile } from '@/lib/autopilot/loContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ actions: [] });

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await sb
    .from('autopilot_actions')
    .select('id, signal_type, action_type, entity_name, signal_reason, status, generated_date, executed_at, failure_reason, priority')
    .eq('lo_id', profile.id)
    .gte('generated_date', since)
    .order('generated_date', { ascending: false })
    .order('priority', { ascending: true })
    .limit(500);

  return NextResponse.json({ actions: data ?? [] });
}
