'use client';

// Phase 123 — Financial Concierge: AI next-product recommendations (educational).
import { useState } from 'react';
import { IconSparkles } from '@tabler/icons-react';

interface Rec { title: string; why: string; tradeoff: string }

export function FinancialConcierge({ token }: { token: string }) {
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/borrower-portal/${token}/concierge`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setRecs(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch { setRecs([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6">
      <div className="flex items-center gap-2 mb-2">
        <IconSparkles size={18} className="text-[#C9A95C]" />
        <p className="text-[13px] font-medium text-[#1A1816]">Financial Concierge</p>
      </div>
      <p className="text-[12px] text-[#6B6560] leading-relaxed mb-4">Ashley can analyze your picture and suggest smart next moves — equity options, refinancing, or your next investment. Educational only, never a commitment.</p>

      {!recs && (
        <button onClick={analyze} disabled={loading} className="px-4 py-2 bg-[#C9A95C] text-[#5A3E15] rounded-xl text-[13px] font-medium disabled:opacity-50 hover:bg-[#D9B96E] transition-colors">
          {loading ? 'Analyzing…' : 'Show my opportunities'}
        </button>
      )}

      {recs && recs.length > 0 && (
        <div className="space-y-3">
          {recs.map((r, i) => (
            <div key={i} className="bg-[#FAFAF8] border border-[#EDEAE4] rounded-xl p-4">
              <p className="text-[13px] font-medium text-[#1A1816]">{r.title}</p>
              <p className="text-[12px] text-[#6B6560] mt-1 leading-relaxed">{r.why}</p>
              {r.tradeoff && <p className="text-[11px] text-[#9B9590] mt-1.5">Tradeoff: {r.tradeoff}</p>}
            </div>
          ))}
          <p className="text-[10px] text-[#9B9590]">Educational only — not investment advice or a commitment to lend. Talk to your loan officer to explore any option.</p>
        </div>
      )}
      {recs && recs.length === 0 && <p className="text-[12px] text-[#9B9590]">No suggestions right now. Your loan officer can walk you through your options.</p>}
    </div>
  );
}
