'use client';

// Phase 81 — single brief item card. Apple surface + category-colored left border,
// @tabler outline icons, soft internal navigation via router.push.

import { useRouter } from 'next/navigation';
import { IconX } from '@tabler/icons-react';
import type { BriefItem, BriefItemCategory } from '@/lib/morning-brief/types';

const BORDER: Record<BriefItemCategory, string> = {
  urgent: 'var(--c-danger)',
  opportunity: 'var(--c-gold)',
  follow_up: 'var(--c-warning)',
  info: 'var(--c-border)',
};

export function MorningBriefCard({
  item,
  onDismiss,
}: {
  item: BriefItem;
  onDismiss: (id: string) => void;
}) {
  const router = useRouter();

  const handleAction = () => {
    if (item.action_type === 'dismiss') {
      onDismiss(item.id);
      return;
    }
    if (item.action_payload) router.push(item.action_payload);
  };

  return (
    <div
      className="flex items-start gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3 pl-3.5"
      style={{ borderLeft: `2px solid ${BORDER[item.category]}` }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-semibold leading-snug truncate"
          style={{ color: item.category === 'urgent' ? 'var(--c-danger)' : 'var(--c-text)' }}
        >
          {item.headline}
        </p>
        <p className="text-[12px] text-[var(--c-label2)] leading-snug mt-0.5 line-clamp-2">{item.body}</p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleAction}
          className="h-7 px-2.5 rounded-[8px] text-[12px] font-medium bg-[rgba(60,60,67,0.06)] hover:bg-[rgba(60,60,67,0.10)] text-[var(--c-text)] transition-colors whitespace-nowrap"
        >
          {item.action_label}
        </button>
        <button
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss"
          className="h-7 w-7 grid place-items-center rounded-[8px] text-[var(--c-label3)] hover:text-[var(--c-text)] hover:bg-[rgba(60,60,67,0.06)] transition-colors"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
