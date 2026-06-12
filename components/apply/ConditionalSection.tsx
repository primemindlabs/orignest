'use client';

import type { ReactNode } from 'react';

export function ConditionalSection({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <div className="animate-in fade-in slide-in-from-top-2 duration-200">{children}</div>;
}
