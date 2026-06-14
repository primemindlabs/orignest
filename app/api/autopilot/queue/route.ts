// Phase 128 — GET today's pending Autopilot queue. Lazily generates the queue on
// first read of the day (so it works without waiting for the nightly cron).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature } from '@/lib/billing/features';
import { resolveLoProfile, toSignatureContext, todayStr } from '@/lib/autopilot/loContext';
import { generateDailyQueue } from '@/lib/autopilot/generateDailyQueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const tier = await resolveOrgTier(orgId);
  const locked = !hasFeature(tier, 'ashley_autopilot');
  if (locked) return NextResponse.json({ locked: true, tier, actions: [], generatedDate: todayStr() });

  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ locked: false, tier, actions: [], generatedDate: todayStr() });

  const date = todayStr();

  // Lazy generation: if nothing exists for today, generate now (best-effort).
  const { data: existing } = await sb
    .from('autopilot_actions')
    .select('id')
    .eq('lo_id', profile.id)
    .eq('generated_date', date)
    .limit(1);
  if (!existing || existing.length === 0) {
    try {
      const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();
      await generateDailyQueue(
        sb,
        profile.id,
        orgId,
        toSignatureContext(profile, (org as { name: string | null } | null)?.name ?? null),
        new Date(),
      );
    } catch (e) {
      console.error('[autopilot/queue] lazy generation failed', e);
    }
  }

  const { data: actions } = await sb
    .from('autopilot_actions')
    .select('*')
    .eq('lo_id', profile.id)
    .eq('generated_date', date)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('generated_at', { ascending: true });

  return NextResponse.json({ locked: false, tier, generatedDate: date, actions: actions ?? [] });
}
