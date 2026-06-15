import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// The 6 valid changed-circumstance categories recognized under TRID
// (12 CFR 1026.19(e)(3)(iv)). A valid COC is the only basis on which a
// re-disclosed Loan Estimate may reset tolerance baselines.
const COC_REASONS: { key: string; label: string; detail: string }[] = [
  {
    key: 'extraordinary_event',
    label: 'Extraordinary event beyond anyone’s control',
    detail: 'War, natural disaster, or other event outside the control of any party that affects the transaction.',
  },
  {
    key: 'inaccurate_info',
    label: 'Information relied on was inaccurate',
    detail: 'Information specific to the consumer or transaction that the estimate relied on becomes inaccurate after disclosure.',
  },
  {
    key: 'new_info',
    label: 'New information specific to the consumer/transaction',
    detail: 'New information not relied on when the LE was issued — e.g. a discovered title issue or undisclosed lien.',
  },
  {
    key: 'eligibility_changed',
    label: 'Consumer eligibility changed',
    detail: 'The consumer is no longer eligible for a term or estimate previously disclosed (e.g. credit, income, or program change).',
  },
  {
    key: 'borrower_requested',
    label: 'Consumer-requested change',
    detail: 'The consumer requests a revision to the loan (program switch, buydown, etc.) that affects disclosed charges.',
  },
  {
    key: 'rate_locked_expired',
    label: 'Rate lock / 10-day estimate expiration',
    detail: 'Interest rate was not locked when the LE was issued, or the consumer did not indicate intent to proceed within 10 business days.',
  },
];

interface TridEvent {
  id: string;
  event_type: string;
  event_date: string | null;
  deadline_date: string | null;
  is_compliant: boolean | null;
  notes: string | null;
  created_at: string;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function ChangedCircumstancesPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Defensive: trid_events may or may not be present in every environment.
  // Surface only the re-disclosure / revision events that signal a COC may
  // have driven a new disclosure. Never crash the page.
  let revisions: TridEvent[] = [];
  try {
    const { data } = await sb
      .from('trid_events')
      .select('id, event_type, event_date, deadline_date, is_compliant, notes, created_at')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .in('event_type', ['le_revised', 'cd_revised'])
      .order('event_date', { ascending: false });
    revisions = (data ?? []) as TridEvent[];
  } catch {
    revisions = [];
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Changed Circumstances</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          A valid changed circumstance is the only basis for re-disclosing a Loan Estimate that resets fee tolerances.
          Use this log to confirm the reason and the 3-business-day re-disclosure window.
        </p>
      </div>

      {/* Compliance primer */}
      <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-fill)] p-4">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-gold-deep)]">
          Re-disclosure rule
        </div>
        <p className="text-[13px] text-[var(--c-label2)] mt-1.5 leading-relaxed">
          Under TRID (12 CFR 1026.19(e)(4)), a revised Loan Estimate must be delivered or placed in the mail no later
          than <span className="font-medium text-[var(--c-text)]">3 business days</span> after receiving information
          sufficient to establish a valid changed circumstance. A revised LE cannot be issued on or after the date the
          Closing Disclosure is provided.
        </p>
      </div>

      {/* Valid COC reasons reference */}
      <div className="space-y-2">
        <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Valid changed-circumstance reasons</h2>
        <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] divide-y divide-[var(--c-border)]">
          {COC_REASONS.map((r, i) => (
            <div key={r.key} className="flex gap-3 p-3.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--c-fill)] text-[12px] font-semibold text-[var(--c-label2)]">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[var(--c-text)]">{r.label}</div>
                <div className="text-[12.5px] text-[var(--c-label3)] mt-0.5 leading-relaxed">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Re-disclosure history for this loan */}
      <div className="space-y-2">
        <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Re-disclosure history for this loan</h2>
        {revisions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center">
            <p className="text-[13px] font-medium text-[var(--c-text)]">No revised disclosures recorded yet</p>
            <p className="text-[12.5px] text-[var(--c-label3)] mt-1 leading-relaxed">
              When a valid changed circumstance triggers a revised Loan Estimate or Closing Disclosure, log it on the
              loan&rsquo;s TRID timeline. Revisions (LE / CD) will appear here so you can tie each re-disclosure to its
              changed-circumstance reason and confirm the 3-business-day window was met.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-left text-[var(--c-label3)]">
                  <th className="px-3.5 py-2.5 font-medium">Type</th>
                  <th className="px-3.5 py-2.5 font-medium">Issued</th>
                  <th className="px-3.5 py-2.5 font-medium">Deadline</th>
                  <th className="px-3.5 py-2.5 font-medium">On time</th>
                  <th className="px-3.5 py-2.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {revisions.map((ev) => (
                  <tr key={ev.id} className="text-[var(--c-text)]">
                    <td className="px-3.5 py-2.5 font-medium">
                      {ev.event_type === 'le_revised' ? 'Revised LE' : 'Revised CD'}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--c-label2)]">{fmtDate(ev.event_date)}</td>
                    <td className="px-3.5 py-2.5 text-[var(--c-label2)]">{fmtDate(ev.deadline_date)}</td>
                    <td className="px-3.5 py-2.5">
                      {ev.is_compliant == null ? (
                        <span className="text-[var(--c-label3)]">&mdash;</span>
                      ) : ev.is_compliant ? (
                        <span className="text-[var(--c-success)] font-medium">Yes</span>
                      ) : (
                        <span className="text-[var(--c-danger)] font-medium">Late</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--c-label2)] max-w-[200px] truncate" title={ev.notes ?? ''}>
                      {ev.notes || <span className="text-[var(--c-label3)]">&mdash;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-[var(--c-label3)] leading-relaxed">
        Informational tracker. Always document the specific changed-circumstance reason, the date sufficient
        information was received, and the re-disclosure date in your system of record to preserve fee-tolerance
        protection.
      </p>
    </div>
  );
}
