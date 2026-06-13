'use client';

// Phase 123 — Home Wealth Dashboard: value, balance, equity (+ trend).
import { useEffect, useState } from 'react';

interface Snap { home_value: number; mortgage_balance: number; equity: number; monthly_appreciation: number | null; net_worth_growth_ytd: number | null; data_source: string; snapshot_date: string }

const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);

export function HomeWealthDashboard({ token }: { token: string }) {
  const [latest, setLatest] = useState<Snap | null>(null);
  const [series, setSeries] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/wealth`).then((r) => (r.ok ? r.json() : null)).then((d) => { setLatest(d?.latest ?? null); setSeries(d?.series ?? []); }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6 text-[13px] text-[#9B9590]">Loading your wealth map…</div>;
  if (!latest) return <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6 text-[13px] text-[#9B9590]">Your home wealth dashboard will appear once your loan details are in.</div>;

  const equityPct = latest.home_value > 0 ? Math.round((latest.equity / latest.home_value) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-medium text-[#1A1816]">Home Wealth</p>
        <span className="text-[11px] text-[#9B9590] capitalize">{latest.data_source} · {new Date(latest.snapshot_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="bg-[#0F0D0B] rounded-2xl p-5 mb-4">
        <p className="text-[11px] text-[rgba(201,169,92,.55)] mb-1">Your equity</p>
        <p className="text-[30px] font-medium text-[#F5F3F0] font-mono leading-none">{usd(latest.equity)}</p>
        <div className="mt-3 h-[6px] bg-white/[.1] rounded-full overflow-hidden">
          <div className="h-full bg-[#C9A95C]" style={{ width: `${equityPct}%` }} />
        </div>
        <p className="text-[11px] text-white/40 mt-1.5">{equityPct}% of your home’s value</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#FAFAF8] border border-[#EDEAE4] rounded-xl p-3">
          <p className="text-[11px] text-[#9B9590]">Estimated value</p>
          <p className="text-[16px] font-medium text-[#1A1816] font-mono">{usd(latest.home_value)}</p>
        </div>
        <div className="bg-[#FAFAF8] border border-[#EDEAE4] rounded-xl p-3">
          <p className="text-[11px] text-[#9B9590]">Mortgage balance</p>
          <p className="text-[16px] font-medium text-[#1A1816] font-mono">{usd(latest.mortgage_balance)}</p>
        </div>
      </div>

      {series.length > 1 && (
        <p className="text-[11px] text-[#9B9590] mt-3">{series.length} snapshots tracked — your equity is updated over time.</p>
      )}
    </div>
  );
}
