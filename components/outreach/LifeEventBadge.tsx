'use client';

// Phase 102 — small "event coming up" pill for a lead/realtor card. Renders only
// when the next occurrence is within 7 days. Pass the upcoming event(s) in; this is
// presentational (the parent already has the lead's life_events).
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EVENT_META, type OutreachEventType } from './eventMeta';

interface Props {
  eventType: OutreachEventType;
  daysUntil: number; // 0 = today
  href?: string;
}

export function LifeEventBadge({ eventType, daysUntil, href }: Props) {
  if (daysUntil < 0 || daysUntil > 7) return null;
  const meta = EVENT_META[eventType] ?? EVENT_META.birthday;
  const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
  const inner = (
    <Badge variant="gold" size="sm">
      <meta.Icon size={12} className="-ml-0.5" />
      {meta.label} {when}
    </Badge>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
