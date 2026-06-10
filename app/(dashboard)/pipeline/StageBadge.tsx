/** Phase 74 — pipeline stage badge. */
const STAGE_STYLES: Record<string, { label: string; className: string }> = {
  new_inquiry: { label: 'New inquiry', className: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-tertiary)]' },
  pre_qual: { label: 'Pre-qual', className: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-tertiary)]' },
  application: { label: 'Application', className: 'bg-[#C9A95C22] text-[#8A6310]' },
  processing: { label: 'Processing', className: 'bg-[#C9A95C22] text-[#8A6310]' },
  underwriting: { label: 'Underwriting', className: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-tertiary)]' },
  conditional_approval: { label: 'Cond. approval', className: 'bg-[#C9A95C22] text-[#8A6310]' },
  clear_to_close: { label: 'CTC', className: 'bg-[#d1fae5] text-[#065f46]' },
  closed: { label: 'Closed', className: 'bg-[#d1fae5] text-[#065f46]' },
  funded: { label: 'Funded', className: 'bg-[#d1fae5] text-[#065f46]' },
  withdrawn: { label: 'Withdrawn', className: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]' },
  declined: { label: 'Declined', className: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]' },
};

export function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_STYLES[stage] ?? { label: stage.replace(/_/g, ' '), className: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${s.className}`}>{s.label}</span>;
}
