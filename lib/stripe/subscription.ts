import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubscriptionPlan, SubscriptionStatus } from '@/types';
import { getPlanByPriceId } from './plans';

/**
 * Get or create a Stripe customer for an organization.
 */
export async function getOrCreateStripeCustomer(params: {
  orgId: string;
  email: string;
  name: string;
}): Promise<string> {
  const sb = createAdminClient();
  const stripe = getStripe();

  // Check if org already has a Stripe customer ID
  const { data: org } = await sb
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', params.orgId)
    .single();

  if (org?.stripe_customer_id) {
    return org.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      org_id: params.orgId,
    },
  });

  // Save to DB
  await sb
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', params.orgId);

  return customer.id;
}

/**
 * Create a Stripe Checkout session for a plan upgrade or initial subscription.
 */
export async function createCheckoutSession(params: {
  orgId: string;
  customerId: string;
  priceId: string;
  trialDays?: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    subscription_data: params.trialDays
      ? { trial_period_days: params.trialDays, metadata: { org_id: params.orgId } }
      : { metadata: { org_id: params.orgId } },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      org_id: params.orgId,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
  });

  if (!session.url) {
    throw new Error('Failed to create Stripe checkout session URL.');
  }

  return session.url;
}

/**
 * Create a Stripe Customer Portal session for managing billing.
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

/**
 * Sync Stripe subscription status to the organizations table.
 * Called from the Stripe webhook handler.
 */
export async function syncSubscription(params: {
  stripeSubscriptionId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  customerId: string;
}): Promise<void> {
  const sb = createAdminClient();

  const plan = getPlanByPriceId(params.priceId);
  const subscriptionPlan: SubscriptionPlan = plan?.id ?? 'starter';

  let subscriptionStatus: SubscriptionStatus;
  switch (params.status) {
    case 'trialing':
      subscriptionStatus = 'trialing';
      break;
    case 'active':
      subscriptionStatus = 'active';
      break;
    case 'past_due':
      subscriptionStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      subscriptionStatus = 'canceled';
      break;
    case 'incomplete':
    case 'incomplete_expired':
      subscriptionStatus = 'incomplete';
      break;
    default:
      subscriptionStatus = 'incomplete';
  }

  await sb
    .from('organizations')
    .update({
      stripe_subscription_id: params.stripeSubscriptionId,
      subscription_plan: subscriptionPlan,
      subscription_status: subscriptionStatus,
      trial_ends_at: null, // managed by Stripe now
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', params.customerId);
}

/**
 * Check if an org has an active subscription (or is trialing).
 */
export async function hasActiveSubscription(orgId: string): Promise<boolean> {
  const sb = createAdminClient();

  const { data } = await sb
    .from('organizations')
    .select('subscription_status, trial_ends_at')
    .eq('id', orgId)
    .single();

  if (!data) return false;

  if (data.subscription_status === 'active' || data.subscription_status === 'trialing') {
    return true;
  }

  // Check if still in grace trial period
  if (data.trial_ends_at && new Date(data.trial_ends_at) > new Date()) {
    return true;
  }

  return false;
}
