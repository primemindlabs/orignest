import type { ReactNode } from 'react';

/**
 * Standard dashboard page container.
 *
 * Every (dashboard) page should wrap its content in <PageShell> so the content
 * column shares one consistent width and vertical rhythm across the whole app
 * (the surrounding (dashboard) layout already supplies the outer p-4 sm:p-6
 * padding). Centers at max-w-6xl (~1152px) — roomy enough for the data tables
 * an MLO CRM leans on.
 *
 * Pages that are intentionally full-bleed (kanban board, split-view inbox,
 * power dialer) should NOT use this.
 */
export function PageShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl space-y-6 ${className}`.trim()}>
      {children}
    </div>
  );
}

export default PageShell;
