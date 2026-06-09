'use client';

/** Phase 35.3 — UI wrapper that locks gated content with an upgrade CTA. */
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';
import { minimumPlanFor, type FeatureKey } from '@/lib/billing/features';

export function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { hasFeature, isLoading } = usePlan();
  if (isLoading) return <>{children}</>;
  if (hasFeature(feature)) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--c-bg)]/80 rounded-[12px]">
        <div className="text-center px-6 py-4">
          <Lock className="h-6 w-6 text-[var(--c-gold)] mx-auto mb-2" />
          <p className="text-[13px] font-medium text-[var(--c-text)] mb-1">{minimumPlanFor(feature)} feature</p>
          <Link href="/settings/billing" className="text-[12px] text-[var(--c-gold-deep)] underline hover:no-underline">Upgrade to unlock →</Link>
        </div>
      </div>
    </div>
  );
}
