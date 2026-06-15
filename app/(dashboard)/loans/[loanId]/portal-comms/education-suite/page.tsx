import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { buildStageExplainer, type StageExplainer } from '@/lib/portal/stageExplainers';

export const dynamic = 'force-dynamic';

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qualification',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditional Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Closed',
};

interface Resource {
  title: string;
  blurb: string;
  href: string;
}

// Curated, evergreen borrower-facing education links. Stable government/regulatory
// sources so the list never goes stale or off-message (compliance-safe, no rates).
const RESOURCES: Resource[] = [
  {
    title: 'Your Home Loan Toolkit (CFPB)',
    blurb: 'Step-by-step guide from the Consumer Financial Protection Bureau covering the whole mortgage process.',
    href: 'https://www.consumerfinance.gov/owning-a-home/loan-options/',
  },
  {
    title: 'Understanding the Loan Estimate',
    blurb: 'How to read the official Loan Estimate so the borrower knows what to look for.',
    href: 'https://www.consumerfinance.gov/owning-a-home/loan-estimate/',
  },
  {
    title: 'Understanding the Closing Disclosure',
    blurb: 'A plain-language walkthrough of the 5-page document reviewed before closing.',
    href: 'https://www.consumerfinance.gov/owning-a-home/closing-disclosure/',
  },
  {
    title: 'Buying a House: Closing Day Checklist',
    blurb: 'What to bring and what to expect on closing day.',
    href: 'https://www.consumerfinance.gov/owning-a-home/process/close/',
  },
];

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

  // Best-effort: resolve the assigned LO's first name for the {lo} substitution.
  let loFirstName = '';
  if (lead?.assigned_to) {
    try {
      const { data: lo } = await sb
        .from('profiles')
        .select('first_name')
        .eq('id', lead.assigned_to)
        .maybeSingle();
      loFirstName = (lo?.first_name as string | null) ?? '';
    } catch {
      loFirstName = '';
    }
  }

  const stage = (lead?.stage as string | null) ?? '';
  const stageLabel = STAGE_LABELS[stage] ?? (stage ? stage.replace(/_/g, ' ') : 'Unknown');

  let explainer: StageExplainer | null = null;
  try {
    explainer = buildStageExplainer(stage, loFirstName);
  } catch {
    explainer = null;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Education Suite</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Stage-appropriate, plain-language content you can share with the borrower — plus curated resources.
        </p>
      </div>

      {/* Current-stage card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Current stage</span>
          <span className="text-[12px] font-semibold text-[var(--c-gold-deep)] capitalize">{stageLabel}</span>
        </div>

        {explainer ? (
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--c-text)]">{explainer.headline}</h2>
              <p className="text-[13px] text-[var(--c-label2)] mt-1 leading-relaxed">{explainer.what_it_means}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[var(--c-fill)] rounded-[10px] p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Typical time</p>
                <p className="text-[13px] text-[var(--c-text)] mt-1 font-medium">{explainer.typical_time}</p>
              </div>
              <div className="bg-[var(--c-fill)] rounded-[10px] p-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">What they need to do</p>
                <p className="text-[13px] text-[var(--c-text)] mt-1 font-medium leading-snug">{explainer.you_need_to}</p>
              </div>
            </div>

            {explainer.faq.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Common questions</p>
                {explainer.faq.map((f, i) => (
                  <details key={i} className="group border border-[var(--c-border)] rounded-[10px] px-3 py-2">
                    <summary className="cursor-pointer list-none text-[13px] font-medium text-[var(--c-text)] flex items-center justify-between">
                      <span>{f.q}</span>
                      <span className="text-[var(--c-label3)] group-open:rotate-180 transition-transform">⌄</span>
                    </summary>
                    <p className="text-[13px] text-[var(--c-label2)] mt-2 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-5">
            <p className="text-[13px] text-[var(--c-label2)] leading-relaxed">
              No stage-specific education content is available for this loan&apos;s current stage
              {stage ? ` (${stageLabel})` : ''}. The curated resources below apply at any point in the loan.
            </p>
          </div>
        )}
      </div>

      {/* Curated resources */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] mb-2">Curated resources</p>
        <div className="space-y-2">
          {RESOURCES.map((r) => (
            <a
              key={r.href}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4 hover:border-[var(--c-gold-deep)] transition-colors"
            >
              <p className="text-[14px] font-semibold text-[var(--c-text)]">{r.title}</p>
              <p className="text-[12px] text-[var(--c-label2)] mt-0.5 leading-relaxed">{r.blurb}</p>
            </a>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-[var(--c-label3)]">
        Content updates automatically as the loan moves through each stage. External links open in a new tab.
      </p>
    </div>
  );
}
