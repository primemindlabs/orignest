/**
 * Phase 127 — compact, read-only Ashley Brain™ block.
 * Used in the morning brief, call-prep, and Autopilot cards. Pure presentational
 * (no client hooks) so it can render in a Server Component.
 */
import { Brain } from 'lucide-react';
import type { BrainMemory } from '@/lib/brain/types';

export function BrainSummaryBlock({
  memories,
  entityName,
  max = 3,
}: {
  memories: BrainMemory[];
  entityName: string;
  max?: number;
}) {
  if (!memories.length) return null;

  return (
    <div className="bg-navy/[0.03] border border-navy/15 rounded-[8px] px-3.5 py-2.5">
      <p className="text-[11px] font-semibold text-navy mb-1.5 flex items-center gap-1">
        <Brain size={12} /> Ashley knows about {entityName}
      </p>
      <ul className="space-y-1">
        {memories.slice(0, max).map((m) => (
          <li key={m.id} className="text-[12px] text-label-2 leading-relaxed">
            · {m.memory_text}
          </li>
        ))}
      </ul>
    </div>
  );
}
