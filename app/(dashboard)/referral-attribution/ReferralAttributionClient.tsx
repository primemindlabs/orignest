'use client';

import { useCallback, useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';

interface SourceMetrics {
  source: string;
  total_leads: number;
  contacted: number;
  pre_qualified: number;
  applied: number;
  closed: number;
  total_volume: number;
  conversion_rate: number;
}
interface PartnerMetrics {
  partner_id: string;
  partner_name: string;
  partner_email: string | null;
  total_leads: number;
  closed: number;
  total_volume: number;
  conversion_rate: number;
}

const RANGES = [
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'Last 6 months', value: '182' },
  { label: 'Last 1 year', value: '365' },
  { label: 'All time', value: 'all' },
];

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function prettySource(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReferralAttributionClient() {
  const [days, setDays] = useState('365');
  const [sources, setSources] = useState<SourceMetrics[]>([]);
  const [partners, setPartners] = useState<PartnerMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/referral-attribution?days=${days}`);
    if (res.ok) {
      const j = (await res.json()) as { sources: SourceMetrics[]; top_partners: PartnerMetrics[] };
      setSources(j.sources ?? []);
      setPartners(j.top_partners ?? []);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const totalLeads = sources.reduce((s, x) => s + x.total_leads, 0);
  const totalVolume = sources.reduce((s, x) => s + x.total_volume, 0);
  const totalClosed = sources.reduce((s, x) => s + x.closed, 0);
  const bestSource = sources.slice().sort((a, b) => b.closed - a.closed)[0];
  const overallConv = totalLeads > 0 ? Math.round((totalClosed / totalLeads) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <GitBranch size={22} className="text-blue" />
          <h1 className="text-[24px] font-bold text-label tracking-tight">Referral Attribution</h1>
        </div>
        <select value={days} onChange={(e) => setDays(e.target.value)} className="px-3 py-2 rounded-[8px] border border-border bg-white text-sm">
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Leads" value={String(totalLeads)} />
        <Stat label="Closed Volume" value={fmt(totalVolume)} />
        <Stat label="Best Source" value={bestSource ? prettySource(bestSource.source) : '—'} />
        <Stat label="Overall Conv. Rate" value={`${overallConv}%`} />
      </div>

      {/* Source performance */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.06]">
          <h2 className="text-sm font-semibold text-label">Source Performance</h2>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-label-3">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-label-3">No lead data in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06] bg-bg">
                  {['Source', 'Leads', 'Contacted', "Pre-Qual'd", 'Applied', 'Closed', 'Volume', 'Conv %'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {sources.map((s) => (
                  <tr key={s.source} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-label">{prettySource(s.source)}</p>
                      <div className="mt-1.5 h-1.5 w-28 rounded-full bg-black/[0.06] overflow-hidden">
                        <div className="h-full bg-blue" style={{ width: `${Math.min(s.conversion_rate, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-label-2">{s.total_leads}</td>
                    <td className="px-4 py-3 text-sm text-label-2">{s.contacted}</td>
                    <td className="px-4 py-3 text-sm text-label-2">{s.pre_qualified}</td>
                    <td className="px-4 py-3 text-sm text-label-2">{s.applied}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-label">{s.closed}</td>
                    <td className="px-4 py-3 text-sm text-label-2">{fmt(s.total_volume)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-label">{s.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top partners */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.06]">
          <h2 className="text-sm font-semibold text-label">Top Referring Partners</h2>
        </div>
        {partners.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-label-3">No partner-referred leads in this period yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06] bg-bg">
                  {['Partner', 'Leads Sent', 'Closed', 'Volume', 'Conv %'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {partners.map((p) => (
                  <tr key={p.partner_id} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-label">{p.partner_name}</p>
                      {p.partner_email && <p className="text-[11px] text-label-3">{p.partner_email}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-label-2">{p.total_leads}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-label">{p.closed}</td>
                    <td className="px-4 py-3 text-sm text-label-2">{fmt(p.total_volume)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-label">{p.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
      <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[20px] font-bold text-label leading-tight truncate">{value}</p>
    </div>
  );
}
