import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PLANS } from '@/lib/stripe/plans';
import { Check, AlertCircle, CheckCircle2, Clock, CreditCard, Users } from 'lucide-react';
import { BillingActions } from './BillingActions';
import { format } from 'date-fns';
import type { SubscriptionStatus } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Billing' };

const STATUS_CONFIG: Record<SubscriptionStatus, {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon: React.ReactNode;
}> = {
  active: { label: 'Active', variant: 'success', icon: <CheckCircle2 size={14} /> },
  trialing: { label: 'Trial', variant: 'info', icon: <Clock size={14} /> },
  past_due: { label: 'Past Due', variant: 'danger', icon: <AlertCircle size={14} /> },
  canceled: { label: 'Canceled', variant: 'neutral', icon: <AlertCircle size={14} /> },
  incomplete: { label: 'Incomplete', variant: 'warning', icon: <AlertCircle size={14} /> },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string };
}) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('role').eq('clerk_user_id', userId).maybeSingle(),
    sb
      .from('organizations')
      .select(
        'id, name, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, billing_email'
      )
      .eq('clerk_org_id', orgId)
      .maybeSingle(),
  ]);

  // Only admins can view billing
  if (profile?.role !== 'admin' && profile?.role !== 'branch_manager') {
    redirect('/dashboard');
  }

  const plan = org?.subscription_plan ?? 'starter';
  const status = (org?.subscription_status ?? 'incomplete') as SubscriptionStatus;
  const planConfig = PLANS[plan as keyof typeof PLANS];
  const statusConfig = STATUS_CONFIG[status];

  // Count seats used
  const { count: seatCount } = await sb
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org?.id ?? '')
    .eq('active', true);

  const seatsUsed = seatCount ?? 0;
  const seatsTotal = planConfig?.seats ?? 1;

  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const isTrialing = status === 'trialing';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Billing</h1>
        <p className="text-label-2 text-sm mt-0.5">Manage your subscription and payment method</p>
      </div>

      {/* Checkout success/cancel banners */}
      {searchParams.checkout === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-card bg-green/5 border border-green/20">
          <CheckCircle2 size={18} className="text-green flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green">Subscription activated!</p>
            <p className="text-xs text-green/80 mt-0.5">
              Your 14-day free trial has started. No charges until the trial ends.
            </p>
          </div>
        </div>
      )}

      {searchParams.checkout === 'canceled' && (
        <div className="flex items-center gap-3 p-4 rounded-card bg-orange/5 border border-orange/20">
          <AlertCircle size={18} className="text-orange flex-shrink-0" />
          <p className="text-sm text-orange font-medium">
            Checkout canceled. Your subscription has not changed.
          </p>
        </div>
      )}

      {/* Past due warning */}
      {status === 'past_due' && (
        <div className="flex items-center gap-3 p-4 rounded-card bg-red/5 border border-red/20">
          <AlertCircle size={18} className="text-red flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red">Payment failed</p>
            <p className="text-xs text-red/80 mt-0.5">
              Update your payment method to keep your account active.
            </p>
          </div>
        </div>
      )}

      {/* ── Current plan card ─────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-[17px] font-bold text-black">
                {planConfig?.name ?? plan} Plan
              </h2>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  statusConfig.variant === 'success'
                    ? 'bg-green/10 text-green'
                    : statusConfig.variant === 'info'
                    ? 'bg-blue/10 text-blue'
                    : statusConfig.variant === 'danger'
                    ? 'bg-red/10 text-red'
                    : statusConfig.variant === 'warning'
                    ? 'bg-orange/10 text-orange'
                    : 'bg-fill text-label-2'
                }`}
              >
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </div>
            <p className="text-[28px] font-light text-black tabular-nums tracking-tight metric-value">
              ${planConfig?.price ?? 0}
              <span className="text-sm font-normal text-label-2 ml-1">/month</span>
            </p>
            {isTrialing && trialEndsAt && (
              <p className="text-sm text-blue mt-1">
                Trial ends {format(trialEndsAt, 'MMMM d, yyyy')} — no charge until then
              </p>
            )}
          </div>

          <BillingActions
            hasStripeCustomer={!!org?.stripe_customer_id}
            status={status}
          />
        </div>

        {/* Seat usage */}
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-label-2" />
              <span className="text-sm text-label-2">Seats</span>
            </div>
            <span className="text-sm font-medium text-black">
              {seatsUsed} / {seatsTotal} used
            </span>
          </div>
          <div className="h-1.5 bg-fill rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                seatsUsed / seatsTotal >= 0.9
                  ? 'bg-orange'
                  : seatsUsed >= seatsTotal
                  ? 'bg-red'
                  : 'bg-blue'
              }`}
              style={{ width: `${Math.min(100, (seatsUsed / seatsTotal) * 100)}%` }}
            />
          </div>
          {seatsUsed >= seatsTotal && (
            <p className="text-xs text-orange mt-1">
              Seat limit reached. Upgrade your plan to add more team members.
            </p>
          )}
        </div>
      </div>

      {/* ── Plan comparison ───────────────────────────────────────── */}
      <div>
        <h3 className="text-[15px] font-semibold text-black mb-3">Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(PLANS).map((p) => {
            const isCurrent = p.id === plan;
            return (
              <div
                key={p.id}
                className={`relative bg-surface rounded-card border-2 p-5 ${
                  isCurrent ? 'border-blue' : 'border-border'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Current plan
                  </span>
                )}
                <div className="mb-3">
                  <p className="text-sm font-semibold text-black">{p.name}</p>
                  <p className="text-[22px] font-light metric-value text-black">
                    ${p.price}
                    <span className="text-xs font-normal text-label-2 ml-1">/mo</span>
                  </p>
                  <p className="text-xs text-label-2">Up to {p.seats} seat{p.seats !== 1 ? 's' : ''}</p>
                </div>
                <ul className="space-y-1.5">
                  {p.features.slice(0, 6).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-label-2">
                      <Check size={12} className="text-green flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Payment method note ───────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 bg-fill rounded-card border border-border">
        <CreditCard size={16} className="text-label-2 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-label-2">
          <p className="font-medium text-black">Payment method</p>
          <p className="mt-0.5">
            Payment methods are managed securely through Stripe. Click &quot;Manage Billing&quot; to update
            your card, download invoices, or change your plan.
          </p>
        </div>
      </div>
    </div>
  );
}
