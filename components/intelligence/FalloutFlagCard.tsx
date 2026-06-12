/**
 * Phase 129 — a single fallout-risk flag card. Severity drives the accent:
 * high = terra, medium = gold, low = slate.
 */
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import type { FalloutFlag } from '@/lib/intelligence/types';

const SEVERITY: Record<string, { color: string; bg: string; Icon: typeof IconAlertTriangle }> = {
  high: { color: '#C4724A', bg: '#FFF4F0', Icon: IconAlertTriangle },
  medium: { color: '#C9A95C', bg: '#FAF6EC', Icon: IconAlertCircle },
  low: { color: '#6B7B8D', bg: '#F4F2EF', Icon: IconInfoCircle },
};

export function FalloutFlagCard({ flag }: { flag: FalloutFlag }) {
  const s = SEVERITY[flag.severity] ?? SEVERITY.low;
  const Icon = s.Icon;
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: s.bg }}>
      <Icon size={16} style={{ color: s.color }} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm text-[#1A1A1A]">{flag.description}</p>
        <p className="text-[11px] uppercase tracking-wide mt-0.5" style={{ color: s.color }}>
          {flag.severity} risk
        </p>
      </div>
    </div>
  );
}
