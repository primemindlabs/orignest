'use client';

import Link from 'next/link';
import type { Application } from '@/types/apply';

// Canonical question wording mirrors components/apply/sections/DeclarationsSection.tsx
const QUESTIONS: { key: keyof Application; label: string }[] = [
  { key: 'declaration_bankruptcy', label: 'Have you declared bankruptcy in the past 7 years?' },
  { key: 'declaration_foreclosure', label: 'Have you had a property foreclosed in the past 7 years?' },
  { key: 'declaration_lawsuit', label: 'Are you a party to a lawsuit?' },
  { key: 'declaration_delinquent', label: 'Are you delinquent on any federal debt?' },
  { key: 'declaration_alimony', label: 'Are you obligated to pay alimony or child support?' },
  { key: 'declaration_borrowed_down', label: 'Is any part of the down payment borrowed?' },
  { key: 'declaration_us_citizen', label: 'Are you a U.S. citizen?' },
  { key: 'declaration_primary_res', label: 'Will you occupy the property as your primary residence?' },
];

function statusLabel(status?: string | null): { text: string; tone: string } {
  switch (status) {
    case 'submitted':
      return { text: 'Submitted', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'reviewed':
      return { text: 'Reviewed', tone: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'in_progress':
      return { text: 'In progress', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { text: 'Draft', tone: 'bg-gray-50 text-gray-600 border-gray-200' };
  }
}

function Answer({ value }: { value: boolean | null | undefined }) {
  if (value === true) {
    return <span className="text-[13px] font-semibold text-[var(--c-text)]">Yes</span>;
  }
  if (value === false) {
    return <span className="text-[13px] font-semibold text-[var(--c-text)]">No</span>;
  }
  return <span className="text-[13px] text-[var(--c-label3)]">Not answered</span>;
}

export function DeclarationsView({
  application,
  loanId,
}: {
  application: Partial<Application>;
  loanId: string;
}) {
  const answered = QUESTIONS.filter((q) => application[q.key] === true || application[q.key] === false).length;
  const badge = statusLabel(application.status);
  const submitted = application.submitted_at
    ? new Date(application.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
            {badge.text}
          </span>
          <span className="text-[12px] text-[var(--c-label2)]">
            {answered} of {QUESTIONS.length} answered
            {submitted ? ` · submitted ${submitted}` : ''}
          </span>
        </div>
        <Link
          href={`/loans/${loanId}/apply-1003`}
          className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline whitespace-nowrap"
        >
          Edit in 1003 →
        </Link>
      </div>

      <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] divide-y divide-[var(--c-border)]">
        {QUESTIONS.map((q) => (
          <div key={q.key as string} className="flex items-start justify-between gap-4 px-4 py-3">
            <p className="text-[13px] text-[var(--c-label2)] leading-snug">{q.label}</p>
            <div className="shrink-0 pt-0.5">
              <Answer value={application[q.key] as boolean | null | undefined} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[var(--c-label3)]">
        Answers are read-only here. Update them in the borrower&apos;s digital 1003 application.
      </p>
    </div>
  );
}
