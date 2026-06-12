'use client';

import { useState } from 'react';
import { SectionShell, SectionHeader } from '../fields';
import { SECTION_LABELS, type Application, type ApplicationSection } from '@/types/apply';

interface Props {
  application: Partial<Application>;
  onNext: (section: ApplicationSection) => void;
  onSubmit?: () => Promise<void> | void;
}

const money = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);

export function ReviewSection({ application, onNext, onSubmit }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const a = application;

  const rows: { section: ApplicationSection; label: string; value: string }[] = [
    { section: 'personal', label: 'Name', value: `${a.borrower_first_name ?? ''} ${a.borrower_last_name ?? ''}`.trim() || '—' },
    { section: 'personal', label: 'Contact', value: [a.borrower_phone, a.borrower_email].filter(Boolean).join(' · ') || '—' },
    { section: 'employment', label: 'Employment', value: (a.employment_type ?? '—').replace('_', ' ') },
    { section: 'employment', label: 'Monthly income', value: money(a.gross_monthly_income) },
    { section: 'property', label: 'Property', value: [a.property_city, a.property_state].filter(Boolean).join(', ') || '—' },
    { section: 'property', label: 'Purpose', value: (a.loan_purpose ?? '—').replace('_', ' ') },
    { section: 'loan', label: 'Loan amount', value: money(a.desired_loan_amount) },
    { section: 'assets', label: 'Monthly debts', value: money(a.monthly_debts) },
  ];

  async function submit() {
    if (!onSubmit) return;
    setSubmitting(true);
    await onSubmit();
  }

  return (
    <SectionShell>
      <SectionHeader title="Review & submit" subtitle="Tap any row to make a change." />
      <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {rows.map((r, i) => (
          <button
            key={i}
            onClick={() => onNext(r.section)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs text-gray-400">{r.label}</p>
              <p className="text-sm text-gray-800 truncate capitalize">{r.value}</p>
            </div>
            <span className="text-xs text-[#C9A95C] shrink-0">Edit {SECTION_LABELS[r.section] ? '' : ''}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        By submitting, you confirm the information is accurate to the best of your knowledge. Your information is
        secure and encrypted.
      </p>

      <button
        onClick={submit}
        disabled={submitting}
        style={{ background: '#C9A95C' }}
        className="w-full py-3.5 rounded-2xl text-white font-semibold hover:brightness-95 transition-all disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit Application'}
      </button>
    </SectionShell>
  );
}
