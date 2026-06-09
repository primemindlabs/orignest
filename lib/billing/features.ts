/**
 * Phase 35.2 — feature matrix keyed to the live plan tiers (starter/growth/team).
 * Display plans live in lib/stripe/plans.ts; THIS file is the gating source of
 * truth (which features each tier unlocks). Isomorphic — safe on client + server.
 */

export type EffectiveTier = 'starter' | 'growth' | 'team';

export const FEATURE_KEYS = [
  'pipeline', 'loan_file', 'borrower_portal', 'realtor_portal',
  'ai_morning_brief', 'condition_prediction', 'document_auto_pop', 'smart_checklist', 'basic_campaigns',
  'power_dialer', 'campaign_manager', 'ad_center', 'ai_draft_engine',
  'branch_manager', 'ai_content_studio', 'course_builder', 'api_access',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const CORE: Record<FeatureKey, boolean> = {
  pipeline: true, loan_file: true, borrower_portal: true, realtor_portal: true,
  ai_morning_brief: true, condition_prediction: true, document_auto_pop: true, smart_checklist: true, basic_campaigns: true,
  power_dialer: false, campaign_manager: false, ad_center: false, ai_draft_engine: false,
  branch_manager: false, ai_content_studio: false, course_builder: false, api_access: false,
};

export const FEATURE_MATRIX: Record<EffectiveTier, Record<FeatureKey, boolean>> = {
  starter: { ...CORE },
  growth: { ...CORE, power_dialer: true, campaign_manager: true, ad_center: true, ai_draft_engine: true },
  team: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>,
};

const GROWTH_FEATURES: FeatureKey[] = ['power_dialer', 'campaign_manager', 'ad_center', 'ai_draft_engine'];
const TEAM_FEATURES: FeatureKey[] = ['branch_manager', 'ai_content_studio', 'course_builder', 'api_access'];

export function hasFeature(tier: EffectiveTier, feature: FeatureKey): boolean {
  return FEATURE_MATRIX[tier]?.[feature] === true;
}

export function minimumPlanFor(feature: FeatureKey): string {
  if (GROWTH_FEATURES.includes(feature)) return 'Growth ($199/mo)';
  if (TEAM_FEATURES.includes(feature)) return 'Team ($399/mo)';
  return 'Growth';
}

export interface OrgBilling {
  subscription_plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

/**
 * Resolve the EFFECTIVE feature tier for an org.
 *  - active starter/growth/team → that tier
 *  - trialing (or no plan yet, trial not expired) → full Growth-tier access
 *  - past_due → 7-day grace keeps current/growth access, then core-only
 *  - cancelled / expired trial → core-only ('starter')
 */
export function resolveTier(org: OrgBilling): EffectiveTier {
  const plan = (org.subscription_plan ?? '') as EffectiveTier;
  const status = org.subscription_status ?? '';
  const now = Date.now();
  const planValid = plan === 'starter' || plan === 'growth' || plan === 'team';

  if (status === 'trialing' || (!planValid && status !== 'canceled' && status !== 'cancelled')) {
    const trialOk = !org.trial_ends_at || new Date(org.trial_ends_at).getTime() > now;
    return trialOk ? 'growth' : 'starter';
  }
  if (status === 'past_due') {
    const graceEnd = (org.subscription_ends_at ? new Date(org.subscription_ends_at).getTime() : now) + 7 * 86_400_000;
    return now < graceEnd && planValid ? plan : 'starter';
  }
  if (status === 'canceled' || status === 'cancelled') return 'starter';
  if (status === 'active' && planValid) return plan;
  // Default: if a valid plan is set, honor it; else core-only.
  return planValid ? plan : 'starter';
}

export function daysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
