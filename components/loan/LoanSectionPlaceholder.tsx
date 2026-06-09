import { Construction } from 'lucide-react';

/**
 * Clean "section scaffolded, content lands in a later phase" state. Used for
 * loan-file sub-sections whose backing logic ships in a subsequent batch — an
 * honest placeholder, never fake data.
 */
export function LoanSectionPlaceholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">{title}</h1>
      <div className="mt-5 rounded-[14px] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
        <div className="w-10 h-10 rounded-[12px] bg-[var(--c-fill)] flex items-center justify-center mx-auto mb-3">
          <Construction size={18} className="text-[var(--c-label2)]" />
        </div>
        <p className="text-[14px] font-medium text-[var(--c-text)]">{title} workspace</p>
        <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-sm mx-auto leading-relaxed">
          {note ?? 'This section is part of the loan file shell. Its tooling slots in here.'}
        </p>
      </div>
    </div>
  );
}
