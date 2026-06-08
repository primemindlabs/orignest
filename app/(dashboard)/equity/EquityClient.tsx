'use client';

import { useMemo, useState } from 'react';
import { Home, TrendingUp, Wallet, Download, Calculator, Info } from 'lucide-react';

interface Position {
  id: string;
  name: string;
  location: string;
  estimatedValue: number;
  loanBalance: number;
  equity: number;
  ltv: number;
  cashOut: number;
  score: number;
  tier: 'high' | 'moderate' | 'low' | 'underwater';
}

interface Props {
  positions: Position[];
  totals: { count: number; totalEquity: number; totalCashOut: number; avgLtv: number; highTier: number };
}

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const TIER_STYLE: Record<Position['tier'], string> = {
  high: 'bg-gold-100 text-gold-800',
  moderate: 'bg-gold-50 text-gold-700',
  low: 'bg-black/[0.05] text-label-2',
  underwater: 'bg-danger/10 text-danger',
};

export default function EquityClient({ positions, totals }: Props) {
  const [maxLtv, setMaxLtv] = useState(80);

  // Re-model available cash-out live as the user changes the max-LTV cap.
  const remodeled = useMemo(
    () =>
      positions.map((p) => ({
        ...p,
        cashOutAtCap: Math.max(0, Math.round(p.estimatedValue * (maxLtv / 100) - p.loanBalance)),
      })),
    [positions, maxLtv],
  );
  const totalCashOutAtCap = remodeled.reduce((s, p) => s + p.cashOutAtCap, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Equity Tracker</h1>
          <p className="text-[13px] text-label-2 mt-0.5">Cash-out &amp; HELOC opportunities across your closed book</p>
        </div>
        <a
          href="/api/equity/export"
          className="btn-primary inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2"
        >
          <Download className="w-4 h-4" /> Annual equity report
        </a>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tracked homes', value: String(totals.count), icon: Home },
          { label: 'Total equity', value: usd(totals.totalEquity), icon: TrendingUp },
          { label: 'Available cash-out', value: usd(totals.totalCashOut), icon: Wallet },
          { label: 'High-opportunity', value: String(totals.highTier), icon: Calculator },
        ].map((c) => (
          <div key={c.label} className="bg-surface rounded-2xl border border-border p-5 card-shadow">
            <div className="flex items-center gap-2 text-label-2 text-[12px] font-medium mb-2">
              <c.icon className="w-4 h-4 text-gold-600" strokeWidth={1.75} /> {c.label}
            </div>
            <div className="font-mono text-[26px] font-semibold text-label tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Cash-out modeler */}
      <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h2 className="text-[15px] font-semibold text-label">Cash-out modeler</h2>
          <div className="flex items-center gap-3">
            <label className="text-[12px] text-label-2">Max LTV</label>
            <input
              type="range" min={50} max={95} step={1} value={maxLtv}
              onChange={(e) => setMaxLtv(Number(e.target.value))}
              className="accent-gold-600 w-40"
            />
            <span className="font-mono text-[13px] text-label w-10">{maxLtv}%</span>
          </div>
        </div>
        <p className="text-[12px] text-label-2 mb-3">
          At a {maxLtv}% LTV cap, your book could support{' '}
          <span className="font-mono font-semibold text-gold-700">{usd(totalCashOutAtCap)}</span> in cash-out volume.
        </p>
        <p className="text-[11px] text-label-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> Balance uses the original funded amount; home-value trend updates once a property-value feed (ATTOM/DeedMine) is connected.
        </p>
      </div>

      {/* Positions table */}
      <div className="bg-surface rounded-2xl border border-border card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.02] border-b border-black/[0.05]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Borrower</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Home Value</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Balance</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Equity</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">LTV</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Cash-Out @ {maxLtv}%</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Opportunity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {remodeled.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-label-3">No closed loans with value &amp; balance on file yet.</td></tr>
              ) : (
                remodeled.map((p) => (
                  <tr key={p.id} className="hover:bg-black/[0.01] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-label text-[13px]">{p.name}</p>
                      {p.location && <p className="text-[11px] text-label-3">{p.location}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-[13px] text-label">{usd(p.estimatedValue)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[13px] text-label-2">{usd(p.loanBalance)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[13px] font-semibold text-label">{usd(p.equity)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[13px] text-label-2">{p.ltv}%</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[13px] font-semibold text-gold-700">{usd(p.cashOutAtCap)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${TIER_STYLE[p.tier]}`}>
                        {p.tier} · {p.score}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
