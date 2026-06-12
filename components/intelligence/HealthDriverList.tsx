/**
 * Phase 129 — a labelled list of score drivers. `positive` toggles the
 * check/green vs minus/terra treatment. Renders an em-dash when empty.
 */
import { IconCircleCheck, IconCircleMinus } from '@tabler/icons-react';

type Props = {
  label: string;
  items: string[];
  positive: boolean;
};

export function HealthDriverList({ label, items, positive }: Props) {
  const color = positive ? '#1A7A45' : '#C4724A';
  const Icon = positive ? IconCircleCheck : IconCircleMinus;
  return (
    <div>
      <p className="text-xs font-medium text-[#6B7B8D] uppercase tracking-wide mb-2">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#9AA4AE]">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#4A4A4A]">
              <Icon size={15} style={{ color }} className="mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
