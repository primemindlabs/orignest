'use client';

import { SIGNAL_LABELS } from '@/lib/goldmine/types';
import type { GoldmineOpp } from './GoldmineOpportunityCard';

export function GoldmineWinsTab({ wins }: { wins: GoldmineOpp[] }) {
  if (wins.length === 0) {
    return <div className="bg-white rounded-xl border border-[#E8E4DE] px-5 py-8 text-center text-sm text-[#6B7B8D]">No conversions yet — reactivations that turn into loans will show up here.</div>;
  }
  return (
    <div className="bg-white rounded-xl border border-[#E8E4DE] divide-y divide-[#F4F2EF]">
      {wins.map((w) => (
        <div key={w.id} className="px-5 py-3 flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-[#1A7A45] flex items-center justify-center flex-shrink-0 text-white text-[11px]">✓</div>
          <span className="text-sm text-[#1A1A1A] font-medium">{w.contact_name}</span>
          <span className="text-xs text-[#6B7B8D]">{SIGNAL_LABELS[w.signal_type]}</span>
          {w.estimated_comp_dollars != null && (
            <span className="text-xs text-[#1A7A45] ml-auto" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace' }}>
              ~${w.estimated_comp_dollars.toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
