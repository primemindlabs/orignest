'use client';

/**
 * Phase 35.3 / Buyability F7 — locks gated content behind a CONTEXTUAL upgrade prompt
 * shown at the exact moment of value (far higher conversion than a static pricing page).
 * Uses per-feature benefit copy; the locked content is blurred behind the card.
 */
import { IconLock, IconArrowRight, IconSparkles } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { usePlan } from '@/lib/billing/usePlan';
import { minimumPlanFor, FEATURE_COPY, type FeatureKey } from '@/lib/billing/features';

export function FeatureGate({ feature, title, benefit, children }: { feature: FeatureKey; title?: string; benefit?: string; children: React.ReactNode }) {
  const router = useRouter();
  const { hasFeature, isLoading } = usePlan();
  if (isLoading) return <>{children}</>;
  if (hasFeature(feature)) return <>{children}</>;

  const copy = FEATURE_COPY[feature];
  const heading = title ?? copy?.title ?? 'Premium feature';
  const body = benefit ?? copy?.benefit ?? 'Unlock this on a higher plan.';
  const plan = minimumPlanFor(feature);

  return (
    <div className="relative min-h-[220px]">
      <div className="pointer-events-none blur-[3px] opacity-40 select-none" aria-hidden>{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-lg p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-[var(--c-gold-light)] flex items-center justify-center mx-auto mb-3"><IconLock size={20} className="text-[var(--c-gold-deep)]" /></div>
          <p className="text-[15px] font-semibold text-[var(--c-text)]">{heading}</p>
          <p className="text-[12.5px] text-[var(--c-label2)] mt-1.5 leading-relaxed">{body}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--c-gold-deep)] bg-[var(--c-gold-light)] rounded-full px-2.5 py-1"><IconSparkles size={12} /> Included in {plan}</div>
          <button onClick={() => router.push('/settings/billing')} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C9A95C] text-white px-4 py-2.5 text-[13px] font-semibold hover:brightness-95">
            Upgrade to unlock <IconArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
