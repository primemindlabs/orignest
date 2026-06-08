import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import getStripe from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid' }, { status: 403 });

  const { enrollmentId } = (await req.json()) as { enrollmentId: string };

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, stripe_customer_id, croa_disclosure_signed_at')
    .eq('id', enrollmentId)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();
  if (!enrollment?.croa_disclosure_signed_at) {
    return NextResponse.json({ error: 'Must sign CROA disclosure first' }, { status: 403 });
  }

  const priceId = process.env.STRIPE_CREDIT_REPAIR_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: 'Billing is not configured yet. Set STRIPE_CREDIT_REPAIR_PRICE_ID.' }, { status: 503 });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await getStripe().checkout.sessions.create({
    customer: (enrollment.stripe_customer_id as string) ?? undefined,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/status/${params.token}?tab=credit-repair&subscribed=1`,
    cancel_url: `${origin}/status/${params.token}?tab=credit-repair`,
    metadata: { enrollment_id: enrollmentId, lead_id: pt.lead_id as string, org_id: pt.org_id as string },
    subscription_data: { trial_period_days: 30, metadata: { enrollment_id: enrollmentId } },
  });

  return NextResponse.json({ url: session.url });
}
