import type { ReactNode } from 'react';

/**
 * Phase 57.4.2 — section header within a page. The gold left border (`primary`)
 * should mark only the primary section; everything else uses the plain variant.
 */
export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  primary?: boolean;
}

export function SectionHeader({ title, description, action, primary }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className={primary ? 'border-l-2 border-[var(--c-gold)] pl-3' : undefined}>
        <p className="text-[13px] font-[600] uppercase tracking-[0.05em] text-[var(--c-label2)]">{title}</p>
        {description && <p className="text-[12px] text-[var(--c-label3)] mt-0.5 normal-case font-normal tracking-normal">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export default SectionHeader;
