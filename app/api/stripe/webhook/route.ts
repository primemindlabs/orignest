import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { syncSubscription } from '@/lib/stripe/subscription';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPaymentFailedEmail, sendSubscriptionCanceledEmail } from '@/lib/resend';
import { writeAuditEvent } from '@/lib/compliance/audit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const sb = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};
        const clerkOrgId = meta.clerk_org_id;
        const plan = meta.plan ?? 'starter';
        const companyName = meta.company_name;

        if (!clerkOrgId) break;

        // Create or update organization record
        const { data: existingOrg } = await sb
          .from('organizations')
          .select('id')
          .eq('clerk_org_id', clerkOrgId)
          .maybeSingle();

        if (existingOrg) {
          await sb
            .from('organizations')
            .update({
              stripe_customer_id: session.customer as string,
              subscription_plan: plan,
              subscription_status: 'trialing',
              trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingOrg.id);
        } else {
          await sb.from('organizations').insert({
            clerk_org_id: clerkOrgId,
            name: companyName ?? 'Untitled Organization',
            nmls_company_id: meta.nmls_company_id ?? null,
            stripe_customer_id: session.customer as string,
            subscription_plan: plan,
            subscription_status: 'trialing',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        await writeAuditEvent({
          actorId: meta.clerk_user_id ?? 'system',
          orgId: existingOrg?.id ?? 'unknown',
          action: 'billing.changed',
          resourceType: 'organization',
          resourceId: existingOrg?.id ?? 'unknown',
          afterState: { event: 'checkout.completed', plan },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items.data[0];

        await syncSubscription({
          stripeSubscriptionId: sub.id,
          status: sub.status,
          priceId: item.price.id,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          customerId: sub.customer as string,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        await syncSubscription({
          stripeSubscriptionId: sub.id,
          status: 'canceled',
          priceId: sub.items.data[0].price.id,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: false,
          customerId: sub.customer as string,
        });

        // Send cancellation email
        const { data: org } = await sb
          .from('organizations')
          .select('name, billing_email')
          .eq('stripe_customer_id', sub.customer as string)
          .maybeSingle();

        if (org?.billing_email) {
          await sendSubscriptionCanceledEmail({
            to: org.billing_email,
            orgName: org.name,
            endDate: new Date(sub.current_period_end * 1000).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // Update org status to past_due
        if (invoice.customer) {
          await sb
            .from('organizations')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', invoice.customer as string);

          // Send payment failed email
          const { data: org } = await sb
            .from('organizations')
            .select('name, billing_email')
            .eq('stripe_customer_id', invoice.customer as string)
            .maybeSingle();

          if (org?.billing_email && invoice.hosted_invoice_url) {
            await sendPaymentFailedEmail({
              to: org.billing_email,
              orgName: org.name,
              amount: invoice.amount_due,
              invoiceUrl: invoice.hosted_invoice_url,
            });
          }
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    // Return 200 to prevent Stripe retries for non-critical errors
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
