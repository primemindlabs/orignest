import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Phase 57.4.1 — consistent premium page header. Uses existing design tokens only.
 * Drop at the top of any (dashboard) page instead of a bare <h1>.
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href: string }[];
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="border-b border-[var(--c-border)] pb-5 mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 mb-2 text-[11px] text-[var(--c-label3)]">
          {breadcrumb.map((b, i) => (
            <span key={b.href} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              <Link href={b.href} className="hover:text-[var(--c-text)] transition-colors">{b.label}</Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-[650] tracking-[-0.022em] text-[var(--c-text)] truncate">{title}</h1>
          {subtitle && <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
