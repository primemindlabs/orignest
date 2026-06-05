'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Client-side stage filter. Lives in its own file because a `<select onChange>`
 * cannot be rendered from the async Server Component in `page.tsx`.
 */
export function StageFilter({ stages }: { stages: [string, string][] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('stage') ?? '';

  return (
    <select
      value={current}
      className="h-8 px-3 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
      onChange={(e) => {
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        if (e.target.value) params.set('stage', e.target.value);
        else params.delete('stage');
        params.delete('page');
        const qs = params.toString();
        router.push(qs ? `/leads?${qs}` : '/leads');
      }}
    >
      <option value="">All Stages</option>
      {stages.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

/**
 * Clickable table row. The server component renders the `<td>` cells as
 * children; navigation happens client-side.
 */
export function LeadRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="hover:bg-fill transition-colors cursor-pointer"
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
