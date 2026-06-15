import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { AdverseActionClient } from './AdverseActionClient';

export const dynamic = 'force-dynamic';

const ECOA_DEADLINE_DAYS = 30;

// Stages that constitute an adverse credit decision under ECOA / Reg B.
const ADVERSE_STAGES = new Set(['denied', 'declined', 'withdrawn']);

type StatusView = {
  label: string;
  tone: string;
  note: string;
  required: boolean;
  deadline: string | null;
  overdue: boolean;
};

function computeStatus(stage: string | null, decisionAt: Date | null): StatusView {
  const s = (stage ?? '').toLowerCase();

  if (ADVERSE_STAGES.has(s)) {
    let deadline: string | null = null;
    let overdue = false;
    if (decisionAt && !Number.isNaN(decisionAt.getTime())) {
      const due = new Date(decisionAt.getTime() + ECOA_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
      deadline = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      overdue = Date.now() > due.getTime();
    }
    return {
      label: s === 'withdrawn' ? 'Application withdrawn' : 'Adverse decision on file',
      tone: overdue ? 'var(--c-danger)' : 'var(--c-warning)',
      note:
        s === 'withdrawn'
          ? 'A counteroffer or incompleteness notice may be required. Confirm whether an adverse-action notice applies for this withdrawal.'
          : 'A written adverse-action notice with principal reasons is required under ECOA / Reg B.',
      required: true,
      deadline,
      overdue,
    };
  }

  if (s === 'funded' || s === 'closed') {
    return {
      label: 'Approved / funded',
      tone: 'var(--c-success)',
      note: 'No adverse-action notice is required for an approved loan.',
      required: false,
      deadline: null,
      overdue: false,
    };
  }

  return {
    label: 'No adverse decision yet',
    tone: 'var(--c-label2)',
    note: 'This loan is still in process. The adverse-action obligation is triggered only by a denial, counteroffer, or withdrawal.',
    required: false,
    deadline: null,
    overdue: false,
  };
}

export default async function Page({ params }: { params: { loanId: string } }) {
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

  const row = lead as Record<string, unknown>;
  const stage = typeof row.stage === 'string' ? row.stage : null;

  // Defensive: prefer an explicit decision timestamp if the schema has one,
  // otherwise fall back to the last-updated time. Never assume a column exists.
  const decisionRaw =
    (row.decision_at as string | undefined) ??
    (row.decisioned_at as string | undefined) ??
    (row.updated_at as string | undefined) ??
    null;
  const decisionAt = decisionRaw ? new Date(decisionRaw) : null;

  const status = computeStatus(stage, decisionAt);
  const borrowerName =
    [row.first_name, row.last_name].filter((v) => typeof v === 'string' && v).join(' ') || 'this borrower';

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Adverse Action</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          ECOA / Reg B notice obligations and a compliant draft for {borrowerName}.
        </p>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: status.tone }}
          />
          <p className="text-[15px] font-semibold" style={{ color: status.tone }}>
            {status.label}
          </p>
        </div>
        <p className="text-[13px] text-[var(--c-label2)] mt-2 leading-relaxed">{status.note}</p>

        {status.required && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--c-border)] pt-4">
            <div>
              <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Notice required</p>
              <p className="text-[14px] font-semibold text-[var(--c-text)] mt-0.5">Yes — within {ECOA_DEADLINE_DAYS} days</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Send by</p>
              <p
                className="text-[14px] font-semibold mt-0.5"
                style={{ color: status.overdue ? 'var(--c-danger)' : 'var(--c-text)' }}
              >
                {status.deadline ?? '—'}
                {status.overdue ? ' (overdue)' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      <AdverseActionClient loanId={params.loanId} />
    </div>
  );
}
