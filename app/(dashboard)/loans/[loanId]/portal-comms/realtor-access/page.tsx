import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Realtor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  brokerage_name: string | null;
  partnership_tier: string | null;
  partnership_score: number | null;
  last_referral_at: string | null;
};

type RealtorNotification = {
  id: string;
  notification_type: string | null;
  channel: string | null;
  created_at: string | null;
};

const TIER_LABEL: Record<string, string> = {
  prospect: 'Prospect',
  developing: 'Developing',
  active_partner: 'Active Partner',
  top_partner: 'Top Partner',
  dormant: 'Dormant',
};

const NOTIF_LABEL: Record<string, string> = {
  referral_received: 'Referral received',
  application_submitted: 'Application submitted',
  loan_approved: 'Loan approved',
  clear_to_close: 'Clear to close',
  closing_scheduled: 'Closing scheduled',
  loan_funded: 'Loan funded',
  stale_check_in: 'Check-in nudge',
};

// What the referring realtor is kept in the loop on — milestone updates only.
// No borrower PII, financials, credit, or documents are ever exposed to a realtor.
const VISIBLE_MILESTONES = [
  'Application submitted',
  'Loan approved',
  'Clear to close',
  'Closing scheduled',
  'Loan funded',
];

const HIDDEN_ITEMS = [
  'Borrower SSN, income & credit score',
  'Uploaded documents & conditions',
  'Internal notes & team chat',
  'Rate, pricing & lender details',
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, referral_realtor_id')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const realtorId = (lead as { referral_realtor_id?: string | null }).referral_realtor_id ?? null;

  let realtor: Realtor | null = null;
  let notifications: RealtorNotification[] = [];

  if (realtorId) {
    const { data: r } = await sb
      .from('realtors')
      .select('id, first_name, last_name, email, phone, brokerage_name, partnership_tier, partnership_score, last_referral_at')
      .eq('id', realtorId)
      .eq('org_id', orgId)
      .maybeSingle();
    realtor = (r as Realtor | null) ?? null;

    const { data: nlog } = await sb
      .from('realtor_notifications')
      .select('id, notification_type, channel, created_at')
      .eq('lead_id', params.loanId)
      .eq('realtor_id', realtorId)
      .order('created_at', { ascending: false })
      .limit(8);
    notifications = (nlog as RealtorNotification[] | null) ?? [];
  }

  const borrowerName = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'this loan';

  // ---- Empty state: no realtor linked ----
  if (!realtorId || !realtor) {
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Realtor Access</h1>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
            Keep the referring agent in the loop with automatic milestone updates.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--c-fill)] text-[18px]">
            🏠
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--c-text)]">
            {realtorId ? 'Linked realtor not found' : 'No realtor linked to this loan'}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--c-label2)]">
            {realtorId
              ? 'This loan references a realtor that is no longer in your network. Re-link it from your realtor hub.'
              : `Connect the referring agent for ${borrowerName} so they receive automatic milestone updates — without seeing any borrower PII or documents.`}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link
              href="/realtors"
              className="inline-flex items-center rounded-lg bg-[var(--c-gold-deep)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              Browse realtors
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-[13px] font-semibold text-[var(--c-text)]">How realtor access works</h3>
          <ul className="mt-2 space-y-1.5">
            {VISIBLE_MILESTONES.map((m) => (
              <li key={m} className="flex items-center gap-2 text-[13px] text-[var(--c-label2)]">
                <span className="text-[var(--c-gold-deep)]">✓</span> {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // ---- Linked state ----
  const fullName = `${realtor.first_name ?? ''} ${realtor.last_name ?? ''}`.trim() || 'Realtor';
  const tier = realtor.partnership_tier ? TIER_LABEL[realtor.partnership_tier] ?? realtor.partnership_tier : null;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Realtor Access</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          The referring agent receives milestone updates on this loan — milestones only, never borrower data.
        </p>
      </div>

      {/* Linked realtor card */}
      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[16px] font-semibold text-[var(--c-text)]">{fullName}</h2>
              {tier && (
                <span className="rounded-full border border-[var(--c-border)] bg-[var(--c-fill)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-label2)]">
                  {tier}
                </span>
              )}
            </div>
            {realtor.brokerage_name && (
              <p className="mt-0.5 truncate text-[13px] text-[var(--c-label2)]">{realtor.brokerage_name}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[var(--c-label3)]">
              {realtor.email && <span>{realtor.email}</span>}
              {realtor.phone && <span>{realtor.phone}</span>}
              <span>Last referral: {fmtDate(realtor.last_referral_at)}</span>
            </div>
          </div>
          {typeof realtor.partnership_score === 'number' && (
            <div className="shrink-0 text-right">
              <div className="text-[22px] font-bold leading-none text-[var(--c-gold-deep)]">
                {realtor.partnership_score}
              </div>
              <div className="text-[10.5px] uppercase tracking-wide text-[var(--c-label3)]">Partner score</div>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Link
            href={`/realtors/${realtor.id}`}
            className="inline-flex items-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-fill)]"
          >
            View full realtor profile →
          </Link>
        </div>
      </div>

      {/* What they can / cannot see */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Updates they receive</h3>
          <ul className="mt-2 space-y-1.5">
            {VISIBLE_MILESTONES.map((m) => (
              <li key={m} className="flex items-center gap-2 text-[13px] text-[var(--c-label2)]">
                <span className="text-[var(--c-gold-deep)]">✓</span> {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Never shared</h3>
          <ul className="mt-2 space-y-1.5">
            {HIDDEN_ITEMS.map((h) => (
              <li key={h} className="flex items-center gap-2 text-[13px] text-[var(--c-label3)]">
                <span className="text-[var(--c-label3)]">✕</span> {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Notification history */}
      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Updates sent on this loan</h3>
        {notifications.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--c-label3)]">
            No milestone updates have been sent yet. The agent will be notified automatically as this loan advances.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--c-border)]">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="text-[var(--c-text)]">
                  {n.notification_type ? NOTIF_LABEL[n.notification_type] ?? n.notification_type : 'Update'}
                </span>
                <span className="flex items-center gap-2 text-[var(--c-label3)]">
                  {n.channel && (
                    <span className="rounded-full bg-[var(--c-fill)] px-2 py-0.5 text-[11px] uppercase tracking-wide">
                      {n.channel}
                    </span>
                  )}
                  {fmtDate(n.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
