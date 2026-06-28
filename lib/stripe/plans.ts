import { SubscriptionPlan, SubscriptionPlanConfig } from '@/types';

/**
 * Resolve a Stripe price id from the environment. Lazy (called from a getter) so a
 * missing var fails loud at checkout/webhook time rather than crashing `next build`,
 * and never falls back to an invalid literal id in production. Dev gets a clearly
 * non-functional placeholder so local flows don't explode.
 */
function priceId(envVar: string, label: string): string {
  const id = process.env[envVar];
  if (id) return id;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envVar} is not set — required for the Stripe "${label}" plan.`);
  }
  return `price_dev_${label}`;
}

export const PLANS: Record<SubscriptionPlan, SubscriptionPlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 99,
    get stripePriceId() { return priceId('STRIPE_PRICE_STARTER', 'starter'); },
    seats: 1,
    features: [
      '1 loan officer seat',
      'Up to 100 active leads',
      'TRID compliance tracker',
      'TCPA consent management',
      'AI Coach (basic)',
      'Email campaigns',
      'Audit log',
      'Referral partner portal',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 199,
    get stripePriceId() { return priceId('STRIPE_PRICE_GROWTH', 'growth'); },
    seats: 5,
    features: [
      'Up to 5 loan officer seats',
      'Unlimited active leads',
      'TRID + ECOA compliance suite',
      'TCPA consent management',
      'AI Coach (advanced)',
      'Email + SMS campaigns',
      'Pipeline analytics',
      'Branch manager dashboard',
      'Partner network',
      'Audit log + PII access log',
      'Integrations (Encompass, Optimal Blue)',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 399,
    get stripePriceId() { return priceId('STRIPE_PRICE_TEAM', 'team'); },
    seats: 20,
    features: [
      'Up to 20 loan officer seats',
      'Unlimited active leads',
      'Full compliance suite (TRID, TCPA, GLBA, ECOA)',
      'AI Coach (premium)',
      'Email + SMS + voice campaigns',
      'Advanced analytics + fair lending monitoring',
      'White-label borrower portal',
      'Custom NMLS reporting',
      'Priority support + dedicated CSM',
      'SFTP integrations',
      'Custom webhooks',
      'SSO (SAML)',
    ],
  },
};

export function getPlanByPriceId(priceId: string): SubscriptionPlanConfig | null {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId) ?? null;
}

export function getPlan(plan: SubscriptionPlan): SubscriptionPlanConfig {
  return PLANS[plan];
}
