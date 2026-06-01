import { SubscriptionPlan, SubscriptionPlanConfig } from '@/types';

export const PLANS: Record<SubscriptionPlan, SubscriptionPlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 99,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? 'price_starter_monthly',
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
    stripePriceId: process.env.STRIPE_PRICE_GROWTH ?? 'price_growth_monthly',
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
    stripePriceId: process.env.STRIPE_PRICE_TEAM ?? 'price_team_monthly',
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
