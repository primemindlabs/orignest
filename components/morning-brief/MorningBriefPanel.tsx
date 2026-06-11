'use client';

// Phase 81 — Morning Priority Brief panel. Top-of-dashboard stack of dismissible,
// priority-sorted action cards. Collapses entirely once everything is dismissed.
// Mobile (<768px): horizontal scroll strip of cards instead of a vertical stack.

import { useMemo } from 'react';
import { IconSun } from '@tabler/icons-react';
import { format } from 'date-fns';
import { useMorningBrief } from '@/hooks/useMorningBrief';
import { MorningBriefCard } from './MorningBriefCard';

export function MorningBriefPanel() {
  const { brief, dismiss, isLoading } = useMorningBrief();

  const undismissed = useMemo(() => {
    if (!brief?.brief_data?.length) return [];
    const dropped = new Set(brief.dismissed_items ?? []);
    return brief.brief_data
      .filter((i) => !dropped.has(i.id))
      .sort((a, b) => a.priority - b.priority);
  }, [brief]);

  if (isLoading) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <div className="h-3.5 w-32 rounded bg-[rgba(60,60,67,0.08)] mb-3 animate-pulse" />
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 rounded-[12px] bg-[rgba(60,60,67,0.05)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Auto-collapse: nothing to show.
  if (!undismissed.length) return null;

  const time = brief?.generated_at ? format(new Date(brief.generated_at), 'h:mm a') : null;

  return (
    <section className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <IconSun size={15} className="text-[var(--c-gold-deep)]" />
        <span className="text-[13px] font-semibold text-[var(--c-text)]">Your morning brief</span>
        <span className="text-[11px] text-[var(--c-label3)]">
          {undismissed.length} {undismissed.length === 1 ? 'priority' : 'priorities'}
        </span>
        {time && <span className="ml-auto text-[11px] text-[var(--c-label3)]">{time}</span>}
      </div>

      {/* Desktop: vertical stack. Mobile: horizontal scroll strip. */}
      <div className="hidden md:flex md:flex-col gap-2">
        {undismissed.map((item) => (
          <MorningBriefCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
      <div className="md:hidden flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
        {undismissed.map((item) => (
          <div key={item.id} className="min-w-[78%] snap-start">
            <MorningBriefCard item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </section>
  );
}
