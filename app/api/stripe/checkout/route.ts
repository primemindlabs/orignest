import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { PLANS } from '@/lib/stripe/plans';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SubscriptionPlan } from '@/types';

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan, companyName, nmlsCompanyId, billingEmail } = body as {
      plan: SubscriptionPlan;
      companyName?: string;
      nmlsCompanyId?: string;
      billingEmail?: string;
    };

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const stripe = getStripe();
    const sb = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';

    // Get or create org record
    let orgRecord: { id: string; stripe_customer_id: string | null } | null = null;

    if (orgId) {
      const { data } = await sb
        .from('organizations')
        .select('id, stripe_customer_id')
        .eq('clerk_org_id', orgId)
        .maybeSingle();
      orgRecord = data;
    }

    // Get user profile for email
    const { data: profile } = await sb
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    const email = billingEmail ?? profile?.email ?? '';
    const customerName = companyName ?? `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();

    // Get or create Stripe customer
    let customerId = orgRecord?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: customerName,
        metadata: {
          clerk_org_id: orgId ?? '',
          clerk_user_id: userId,
          nmls_company_id: nmlsCompanyId ?? '',
        },
      });
      customerId = customer.id;

      // Save customer ID back to org if we have an org
      if (orgRecord?.id) {
        await sb
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', orgRecord.id);
      }
    }

    const planConfig = PLANS[plan];
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.stripePriceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          clerk_org_id: orgId ?? '',
          clerk_user_id: userId,
          plan,
        },
      },
      success_url: `${appUrl}/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/onboarding?checkout=canceled`,
      metadata: {
        clerk_org_id: orgId ?? '',
        clerk_user_id: userId,
        plan,
        company_name: companyName ?? '',
        nmls_company_id: nmlsCompanyId ?? '',
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
