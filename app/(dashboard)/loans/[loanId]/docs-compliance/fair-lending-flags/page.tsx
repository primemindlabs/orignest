import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type FlagStatus = 'pass' | 'attention' | 'review' | 'na';

type Flag = {
  key: string;
  title: string;
  status: FlagStatus;
  detail: string;
  basis: string;
};

const STATUS_META: Record<FlagStatus, { label: string; tone: string; dot: string }> = {
  pass: { label: 'Pass', tone: 'var(--c-success)', dot: 'var(--c-success)' },
  attention: { label: 'Needs attention', tone: 'var(--c-warning)', dot: 'var(--c-warning)' },
  review: { label: 'Manual review', tone: 'var(--c-gold-deep)', dot: 'var(--c-gold-deep)' },
  na: { label: 'Not applicable', tone: 'var(--c-label3)', dot: 'var(--c-label3)' },
};

export default async function FairLendingFlagsPage({ params }: { params: { loanId: string } }) {
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
  const leadRec = lead as Record<string, unknown>;

  // --- Pull the linked digital application (HMDA/GMI source). Defensive: table may
  // have no row for this loan, or the relation may not exist yet. ---
  let application: Record<string, unknown> | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select('id, status, hmda_race, hmda_ethnicity, hmda_sex, hmda_collected_at')
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    application = (data as Record<string, unknown> | null) ?? null;
  } catch {
    application = null;
  }

  // --- Pull pricing scenarios to detect pricing exceptions / dispersion. Defensive. ---
  let rates: number[] = [];
  try {
    const { data } = await sb
      .from('loan_scenarios')
      .select('interest_rate')
      .eq('lead_id', params.loanId)
      .limit(50);
    rates = ((data as { interest_rate: number | null }[] | null) ?? [])
      .map((s) => (s.interest_rate != null ? Number(s.interest_rate) : null))
      .filter((r): r is number => r != null && !Number.isNaN(r));
  } catch {
    rates = [];
  }

  const flags: Flag[] = [];

  // ---------------------------------------------------------------------------
  // 1. Government Monitoring Information (HMDA / Reg B + Reg C)
  // ---------------------------------------------------------------------------
  const gmiRace = application?.hmda_race as string | null | undefined;
  const gmiEth = application?.hmda_ethnicity as string | null | undefined;
  const gmiSex = application?.hmda_sex as string | null | undefined;
  const gmiAt = application?.hmda_collected_at as string | null | undefined;
  const anyGmi = Boolean(gmiRace || gmiEth || gmiSex || gmiAt);
  const allGmi = Boolean(gmiRace && gmiEth && gmiSex);

  if (!application) {
    flags.push({
      key: 'gmi',
      title: 'Government Monitoring Information (GMI)',
      status: 'attention',
      detail:
        'No digital application is on file for this loan, so HMDA/GMI demographic collection cannot be confirmed. If the application was taken in person or by phone, ensure the demographic information section was offered and documented per Regulation B.',
      basis: 'Regulation B (ECOA) / Regulation C (HMDA)',
    });
  } else if (allGmi) {
    flags.push({
      key: 'gmi',
      title: 'Government Monitoring Information (GMI)',
      status: 'pass',
      detail: `Demographic information was collected${
        gmiAt ? ` on ${new Date(gmiAt).toLocaleDateString()}` : ''
      }. Race, ethnicity, and sex are recorded as offered to the applicant.`,
      basis: 'Regulation C (HMDA)',
    });
  } else if (anyGmi) {
    flags.push({
      key: 'gmi',
      title: 'Government Monitoring Information (GMI)',
      status: 'attention',
      detail:
        'Demographic information is partially recorded. Where the applicant declined to provide it, confirm the "I do not wish to provide" selection is captured — for in-person applications, visual/surname observation may be required.',
      basis: 'Regulation C (HMDA)',
    });
  } else {
    flags.push({
      key: 'gmi',
      title: 'Government Monitoring Information (GMI)',
      status: 'attention',
      detail:
        'No demographic information has been recorded yet. The GMI section must be presented to every applicant; a declination must still be documented.',
      basis: 'Regulation C (HMDA)',
    });
  }

  // ---------------------------------------------------------------------------
  // 2. HMDA reportability / action taken consistency
  // ---------------------------------------------------------------------------
  const reportable = leadRec.hmda_reportable as boolean | null | undefined;
  const actionTaken = leadRec.hmda_action_taken as string | null | undefined;
  if (reportable) {
    flags.push({
      key: 'hmda-action',
      title: 'HMDA action taken',
      status: actionTaken ? 'pass' : 'attention',
      detail: actionTaken
        ? `This file is flagged HMDA-reportable with action taken recorded as "${actionTaken.replace(/_/g, ' ')}".`
        : 'This file is flagged HMDA-reportable but no "action taken" code has been recorded. Set it before the LAR is assembled.',
      basis: 'Regulation C (HMDA) — LAR',
    });
  } else {
    flags.push({
      key: 'hmda-action',
      title: 'HMDA action taken',
      status: 'na',
      detail:
        'This file is not currently flagged HMDA-reportable. If it represents a covered application, mark it reportable and assign an action-taken code.',
      basis: 'Regulation C (HMDA)',
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Adverse action timing (Reg B) — derived from stage / action taken
  // ---------------------------------------------------------------------------
  const stage = String(leadRec.stage ?? '');
  const isDenied =
    actionTaken === 'denied' || /deni|declin|reject|adverse/i.test(stage) || stage === 'lost';
  if (isDenied) {
    flags.push({
      key: 'adverse',
      title: 'Adverse action notice',
      status: 'review',
      detail:
        'This file appears to be denied or withdrawn. Confirm an adverse action notice with specific principal reasons was sent within 30 days of receiving a completed application, and that the reasons match the credit decision.',
      basis: 'Regulation B (ECOA) §1002.9',
    });
  } else {
    flags.push({
      key: 'adverse',
      title: 'Adverse action notice',
      status: 'na',
      detail: 'No adverse action has been taken on this file. No notice is required at this stage.',
      basis: 'Regulation B (ECOA)',
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Pricing exception / rate dispersion (fair-lending pricing risk)
  // ---------------------------------------------------------------------------
  if (rates.length === 0) {
    flags.push({
      key: 'pricing',
      title: 'Pricing & exceptions',
      status: 'na',
      detail:
        'No priced scenarios are on file yet. Once pricing is selected, any rate or fee that deviates from standard rate-sheet pricing should be documented with a non-discriminatory business justification.',
      basis: 'Fair lending — pricing disparity',
    });
  } else {
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    const spread = max - min;
    // A wide spread across comparable scenarios is a prompt to document the
    // reason the borrower was placed off the lowest-priced option.
    const wide = spread >= 0.5;
    flags.push({
      key: 'pricing',
      title: 'Pricing & exceptions',
      status: wide ? 'review' : 'pass',
      detail: wide
        ? `Priced scenarios range from ${min.toFixed(3)}% to ${max.toFixed(3)}% (${spread.toFixed(
            3,
          )}% spread). If the borrower was placed above the lowest comparable option, document the objective, non-discriminatory reason in the file.`
        : `Priced scenarios are tightly clustered (${min.toFixed(3)}%–${max.toFixed(
            3,
          )}%). No pricing exception indicated.`,
      basis: 'Fair lending — pricing disparity',
    });
  }

  const counts = flags.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<FlagStatus, number>>,
  );
  const needsAttention = (counts.attention ?? 0) + (counts.review ?? 0);

  const borrowerName = `${(leadRec.first_name as string) ?? ''} ${
    (leadRec.last_name as string) ?? ''
  }`.trim();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Fair Lending Flags</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Automated fair-lending checkpoints derived from this file
          {borrowerName ? ` for ${borrowerName}` : ''}. Informational only — these prompts assist review and do not replace your compliance officer&apos;s sign-off.
        </p>
      </div>

      {/* Summary banner */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex items-center gap-4">
        <div className="text-center min-w-[64px]">
          <p
            className="text-[30px] font-bold tabular-nums leading-none"
            style={{ color: needsAttention === 0 ? 'var(--c-success)' : 'var(--c-warning)' }}
          >
            {needsAttention}
          </p>
          <p className="text-[10px] text-[var(--c-label3)] mt-1 uppercase tracking-wide">Open items</p>
        </div>
        <div className="border-l border-[var(--c-border)] pl-4">
          <p className="text-[14px] font-semibold text-[var(--c-text)]">
            {needsAttention === 0 ? 'No open fair-lending prompts' : 'Items flagged for review'}
          </p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5 leading-relaxed">
            {needsAttention === 0
              ? 'Every derived checkpoint passed or is not applicable to this file. Re-review when the file status changes.'
              : 'Review the highlighted items below and document the business justification or required notice in the file.'}
          </p>
        </div>
      </div>

      {/* Flags list */}
      <div className="space-y-2.5">
        {flags.map((f) => {
          const meta = STATUS_META[f.status];
          return (
            <div
              key={f.key}
              className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className="mt-[6px] h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.dot }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--c-text)]">{f.title}</p>
                    <p className="text-[11px] text-[var(--c-label3)] mt-0.5">{f.basis}</p>
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                  style={{ color: meta.tone, backgroundColor: 'var(--c-fill)' }}
                >
                  {meta.label}
                </span>
              </div>
              <p className="text-[13px] text-[var(--c-label2)] mt-2.5 leading-relaxed">{f.detail}</p>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
        These checkpoints are generated from data already in the file (digital application, HMDA fields, pricing scenarios, and loan status). They are decision-support prompts only and are not a determination of compliance or discrimination. Consult your designated compliance officer for final review and any required notices.
      </p>
    </div>
  );
}
