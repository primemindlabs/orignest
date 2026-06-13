'use client';

// Phase 123 — Mortgage Health Score ring (r=28, circumference=175.9) + action items.
import { useEffect, useState } from 'react';
import { IconArrowUpRight, IconHeartRateMonitor } from '@tabler/icons-react';
import { PortalEmptyState } from './PortalEmptyState';

interface ActionItem { type: string; label: string; points_potential: number }
interface Score { score: number; credit_score: number | null; equity_estimate: number | null; rate_comparison_delta: number | null; action_items: ActionItem[] }

const C = 175.9;

export function MortgageHealthScore({ token, onAskAshley }: { token: string; onAskAshley?: () => void }) {
  const [score, setScore] = useState<Score | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/health-score`).then((r) => (r.ok ? r.json() : null)).then((d) => setScore(d?.score ?? null)).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6 text-[13px] text-[#9B9590]">Loading your score…</div>;
  if (!score) return (
    <PortalEmptyState
      icon={<IconHeartRateMonitor size={20} className="text-[#C9A95C]" />}
      title="Your Health Score unlocks in processing"
      message="Once your loan reaches processing, we review your credit, equity, and rate to calculate your Mortgage Health Score — automatically, with no action needed from you."
      onAskAshley={onAskAshley}
    />
  );

  const offset = C * (1 - score.score / 100);
  const band = score.score >= 80 ? 'Excellent' : score.score >= 60 ? 'Good' : score.score >= 40 ? 'Fair' : 'Building';

  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6">
      <p className="text-[13px] font-medium text-[#1A1816] mb-4">Mortgage Health Score</p>
      <div className="flex items-center gap-6">
        <div className="relative w-[80px] h-[80px] flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#EDEAE4" strokeWidth="6" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="#C9A95C" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset .7s' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[22px] font-medium text-[#1A1816] font-mono leading-none">{score.score}</span>
          </div>
        </div>
        <div>
          <p className="text-[15px] font-medium text-[#C9A95C]">{band}</p>
          <div className="flex gap-4 mt-1 text-[12px] text-[#6B6560]">
            {score.credit_score != null && <span>Credit {score.credit_score}</span>}
            {score.equity_estimate != null && <span>Equity ${Math.round(score.equity_estimate).toLocaleString()}</span>}
          </div>
        </div>
      </div>

      {score.action_items?.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11px] font-medium text-[#9B9590] uppercase tracking-wide">Ways to improve</p>
          {score.action_items.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-3 bg-[#FAFAF8] border border-[#EDEAE4] rounded-xl px-3 py-2.5">
              <span className="text-[13px] text-[#1A1816]">{a.label}</span>
              {a.points_potential > 0 && <span className="flex items-center gap-0.5 text-[12px] font-medium text-[#C9A95C] flex-shrink-0"><IconArrowUpRight size={13} /> {a.points_potential}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
