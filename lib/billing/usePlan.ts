'use client';

/** Phase 35 — client hook exposing the org's resolved plan + feature flags. */
import { useState, useEffect } from 'react';
import type { FeatureKey, EffectiveTier } from '@/lib/billing/features';

interface PlanState {
  tier: EffectiveTier | null;
  plan: string | null;
  status: string | null;
  features: Partial<Record<FeatureKey, boolean>>;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasFeature: (key: FeatureKey) => boolean;
}

let cache: Omit<PlanState, 'isLoading' | 'hasFeature'> | null = null;

export function usePlan(): PlanState {
  const [state, setState] = useState<Omit<PlanState, 'isLoading' | 'hasFeature'> | null>(cache);
  const [isLoading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let active = true;
    fetch('/api/billing/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) { setLoading(false); return; }
        const next = {
          tier: d.tier ?? null, plan: d.plan ?? null, status: d.status ?? null,
          features: d.features ?? {}, trialEndsAt: d.trial_ends_at ?? null,
          daysRemaining: d.days_remaining ?? null, isAdmin: !!d.is_admin,
        };
        cache = next; setState(next); setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  return {
    tier: state?.tier ?? null,
    plan: state?.plan ?? null,
    status: state?.status ?? null,
    features: state?.features ?? {},
    trialEndsAt: state?.trialEndsAt ?? null,
    daysRemaining: state?.daysRemaining ?? null,
    isAdmin: state?.isAdmin ?? false,
    isLoading,
    hasFeature: (key: FeatureKey) => state?.features?.[key] === true,
  };
}
