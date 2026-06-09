/**
 * Phase 35.3 — server-side feature gate. Call requireFeature(orgId, key) at the
 * top of any gated API route; it throws FeatureGateError → 403 with upgrade info.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveTier, hasFeature, minimumPlanFor, type FeatureKey, type EffectiveTier } from '@/lib/billing/features';

export class FeatureGateError extends Error {
  constructor(public feature: FeatureKey, public currentTier: EffectiveTier, public requiredPlan: string) {
    super(`Feature "${feature}" is not available on your current plan.`);
    this.name = 'FeatureGateError';
  }
}

export async function resolveOrgTier(orgId: string): Promise<EffectiveTier> {
  const sb = createAdminClient();
  const { data: org } = await sb
    .from('organizations')
    .select('subscription_plan, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('id', orgId)
    .maybeSingle();
  if (!org) return 'starter';
  return resolveTier(org);
}

export async function requireFeature(orgId: string, feature: FeatureKey): Promise<void> {
  const tier = await resolveOrgTier(orgId);
  if (!hasFeature(tier, feature)) {
    throw new FeatureGateError(feature, tier, minimumPlanFor(feature));
  }
}

/** Standard 403 JSON body for a locked feature. */
export function featureLockedResponse(err: FeatureGateError) {
  return {
    error: err.message,
    code: 'FEATURE_LOCKED',
    feature: err.feature,
    current_tier: err.currentTier,
    required_plan: err.requiredPlan,
    upgrade_url: '/settings/billing',
  };
}
