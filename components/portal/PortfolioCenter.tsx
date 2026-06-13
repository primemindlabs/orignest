'use client';

// Phase 123 — Real Estate Portfolio (investor/DSCR borrowers).
import { useEffect, useState } from 'react';
import { IconHome, IconBuildingEstate } from '@tabler/icons-react';

interface Prop { id: string; address: string; property_type: string; current_value: number | null; mortgage_balance: number | null; monthly_cash_flow: number | null; is_primary_residence: boolean }
interface Totals { value: number; balance: number; equity: number; cash_flow: number }

const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);

export function PortfolioCenter({ token }: { token: string }) {
  const [properties, setProperties] = useState<Prop[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/portfolio`).then((r) => (r.ok ? r.json() : null)).then((d) => { setProperties(d?.properties ?? []); setTotals(d?.totals ?? null); }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6 text-[13px] text-[#9B9590]">Loading your portfolio…</div>;
  if (properties.length === 0) return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6 text-center">
      <IconBuildingEstate size={28} className="text-[#C9A95C] mx-auto mb-2" />
      <p className="text-[13px] font-medium text-[#1A1816]">No properties yet</p>
      <p className="text-[12px] text-[#9B9590] mt-1">As you build your real estate portfolio, your properties and cash flow will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {totals && (
        <div className="bg-[#0F0D0B] rounded-2xl p-5 grid grid-cols-3 gap-3">
          <div><p className="text-[11px] text-white/40">Portfolio value</p><p className="text-[18px] font-medium text-[#F5F3F0] font-mono">{usd(totals.value)}</p></div>
          <div><p className="text-[11px] text-white/40">Total equity</p><p className="text-[18px] font-medium text-[#C9A95C] font-mono">{usd(totals.equity)}</p></div>
          <div><p className="text-[11px] text-white/40">Monthly cash flow</p><p className="text-[18px] font-medium text-[#F5F3F0] font-mono">{usd(totals.cash_flow)}</p></div>
        </div>
      )}
      {properties.map((p) => (
        <div key={p.id} className="bg-white rounded-2xl border border-[#EDEAE4] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FBF5E6] flex items-center justify-center flex-shrink-0"><IconHome size={17} className="text-[#C9A95C]" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#1A1816] truncate">{p.address}</p>
            <p className="text-[11px] text-[#9B9590] capitalize">{p.property_type.replace(/_/g, ' ')}{p.is_primary_residence ? ' · Primary residence' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-medium text-[#1A1816] font-mono">{usd(p.current_value)}</p>
            {p.monthly_cash_flow != null && p.monthly_cash_flow !== 0 && <p className={`text-[11px] font-mono ${p.monthly_cash_flow >= 0 ? 'text-[#2e8c6a]' : 'text-[#b4413a]'}`}>{usd(p.monthly_cash_flow)}/mo</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
