/**
 * Phase 98 — referral source chip. Shown on pipeline cards, lead rows, detail.
 * Renders nothing for a null/empty source.
 */
import { SOURCE_BADGE_LABELS, SOURCE_BADGE_CLASSES } from '@/lib/analytics/sources';

type Props = {
  source: string | null | undefined;
  detail?: string | null;
  size?: 'sm' | 'md';
};

export function SourceBadge({ source, detail, size = 'sm' }: Props) {
  if (!source) return null;
  const label = SOURCE_BADGE_LABELS[source] ?? source;
  const classes = SOURCE_BADGE_CLASSES[source] ?? 'bg-gray-100 text-gray-500';
  const sizeCls = size === 'sm' ? 'text-xs px-1.5 py-0.5 rounded' : 'text-sm px-2 py-1 rounded-md';
  return (
    <span className={`inline-flex items-center font-medium ${classes} ${sizeCls}`} title={detail ?? undefined}>
      {label}
    </span>
  );
}
