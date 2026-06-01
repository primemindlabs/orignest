import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = createAdminClient();
    const { data: org } = await sb
      .from('organizations')
      .select('stripe_customer_id')
      .eq('clerk_org_id', orgId)
      .maybeSingle();

    if (!org?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please complete checkout first.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.conduitcrm.com';

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
