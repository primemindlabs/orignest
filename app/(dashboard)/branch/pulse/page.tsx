// Phase 130 — Business Pulse™ full page (Branch Manager / Admin, Team tier).
import type { Metadata } from 'next';
import Link from 'next/link';
import { IconActivityHeartbeat } from '@tabler/icons-react';
import { requireTenantAdmin } from '@/lib/admin/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature, FEATURE_COPY } from '@/lib/billing/features';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { ensureTodaysPulse } from '@/lib/businessPulse/computePulseScore';
import { computeOrgBenchmarkMetrics, buildBenchmarkRows } from '@/lib/businessPulse/benchmarks';
import { PulsePageClient } from '@/components/businessPulse/PulsePageClient';
import type { PulseRow } from '@/lib/businessPulse/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Business Pulse' };

export default async function BusinessPulsePage() {
  const { userId, orgId } = await requireTenantAdmin();
  const sb = createAdminClient();

  const tier = await resolveOrgTier(orgId);
  if (!hasFeature(tier, 'business_pulse')) {
    const copy = FEATURE_COPY.business_pulse!;
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-gradient-to-r from-[#FEFDF9] to-[#FFF8ED] rounded-2xl border border-[#C9A95C]/20 px-6 py-6">
          <div className="flex items-center gap-2 mb-1">
            <IconActivityHeartbeat size={18} className="text-[#C9A95C]" />
            <h1 className="font-semibold text-[#1A1A1A] text-lg" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>{copy.title}</h1>
            <span className="text-xs bg-[#C9A95C] text-white px-2 py-0.5 rounded-full">Team</span>
          </div>
          <p className="text-sm text-[#6B7B8D] mb-4">{copy.benefit}</p>
          <Link href="/settings/billing" className="inline-block bg-[#C9A95C] text-white text-sm px-5 py-2.5 rounded-lg hover:brightness-95">
            Upgrade to Team
          </Link>
        </div>
      </div>
    );
  }

  const profile = await resolveLoProfile(sb, userId);

  let score: PulseRow | null = null;
  try {
    if (profile?.id) score = await ensureTodaysPulse(sb, orgId, profile.id);
  } catch (e) {
    console.error('[branch/pulse] compute failed', e);
  }

  if (!score) {
    return (
      <div className="p-6 max-w-2xl text-sm text-[#6B7B8D]">
        Business Pulse isn’t available yet. It generates each morning once your branch has activity.
      </div>
    );
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: history }, metrics] = await Promise.all([
    sb.from('business_pulse_scores').select('score_date, pulse_score').eq('org_id', orgId).gte('score_date', since).order('score_date', { ascending: true }),
    computeOrgBenchmarkMetrics(sb, orgId),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-[#1A1A1A] mb-4" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>
        Business Pulse™
      </h1>
      <PulsePageClient score={score} history={(history ?? []) as { score_date: string; pulse_score: number }[]} benchmarks={buildBenchmarkRows(metrics)} />
    </div>
  );
}
