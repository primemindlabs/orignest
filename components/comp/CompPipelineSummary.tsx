'use client';

// Phase 91 — running take-home projection across the LO's active pipeline. Shows the
// "if all close" totals plus a probability-weighted "expected" view (Phase 83 scores).
// Lives on /settings/compensation — complements (does not duplicate) the dashboard
// MoneyBar, which shows gross commission only.
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface Summary {
  count: number; has_plan: boolean; total_volume: number;
  gross_comp: number; net_comp: number; weighted_gross_comp: number; weighted_net_comp: number;
}
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CompPipelineSummary() {
  const [s, setS] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/comp/pipeline-summary').then((r) => (r.ok ? r.json() : null)).then((d) => { setS(d); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  if (!loaded || !s) return null;

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-[var(--c-gold-deep)]" />
        <h3 className="text-sm font-semibold text-black">Pipeline take-home projection</h3>
        <span className="text-[11px] text-label-2">{s.count} active loan{s.count === 1 ? '' : 's'} · {money(s.total_volume)} volume</span>
      </div>

      {s.count === 0 ? (
        <p className="text-[13px] text-label-2">No active pipeline loans to project yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[12px] border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-label-3">If all close</p>
            <p className="text-[22px] font-bold text-[var(--c-gold-deep)] font-mono mt-0.5">{money(s.net_comp)}</p>
            <p className="text-[11px] text-label-2">net · {money(s.gross_comp)} gross</p>
          </div>
          <div className="rounded-[12px] border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-label-3">Weighted by close probability</p>
            <p className="text-[22px] font-bold text-black font-mono mt-0.5">{money(s.weighted_net_comp)}</p>
            <p className="text-[11px] text-label-2">net · {money(s.weighted_gross_comp)} gross</p>
          </div>
        </div>
      )}
      {!s.has_plan && (
        <p className="text-[11px] text-label-3">Using your dashboard comp rate. Set a full take-home plan (branch split, processor fee) on any loan&apos;s comp calculator.</p>
      )}
    </div>
  );
}
