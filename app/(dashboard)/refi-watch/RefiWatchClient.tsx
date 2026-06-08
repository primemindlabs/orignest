'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingDown, RefreshCw, Sparkles, Copy, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Opp {
  id: string;
  lead_id: string;
  original_rate: number;
  current_market_rate: number;
  rate_spread: number;
  monthly_savings: number;
  annual_savings: number;
  loan_balance_estimate: number | null;
  outreach_status: string;
  ai_message_draft: string | null;
  leads: { first_name: string; last_name: string } | null;
}

interface Stats { total: number; totalMonthlySavings: number; avgSpread: number; sent: number; }

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-black/[0.06] text-label-2',
  sent: 'bg-blue/10 text-blue',
  responded: 'bg-orange/10 text-orange',
  converted: 'bg-green/10 text-green',
  not_interested: 'bg-red/10 text-red',
};

export default function RefiWatchClient() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, totalMonthlySavings: 0, avgSpread: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [modalOpp, setModalOpp] = useState<Opp | null>(null);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/ai/refi-watch');
    if (res.ok) {
      const j = (await res.json()) as { opportunities: Opp[]; stats: Stats };
      setOpps(j.opportunities ?? []);
      setStats(j.stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runScan() {
    setScanning(true); setScanMsg('');
    try {
      const res = await fetch('/api/ai/refi-watch/scan', { method: 'POST' });
      const j = (await res.json()) as { scanned: number; opportunities: number; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Scan failed');
      setScanMsg(`Scanned ${j.scanned} closed loans — found ${j.opportunities} opportunities.`);
      await load();
    } catch (err) {
      setScanMsg(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function generate(opp: Opp) {
    setModalOpp(opp); setDraft(opp.ai_message_draft ?? ''); setCopied(false);
    if (!opp.ai_message_draft) {
      setGenerating(true);
      try {
        const res = await fetch('/api/ai/refi-watch/outreach', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: opp.id }),
        });
        const j = (await res.json()) as { draft?: string };
        setDraft(j.draft ?? '');
      } finally {
        setGenerating(false);
      }
    }
  }

  async function setStatus(opp: Opp, status: string) {
    await fetch('/api/ai/refi-watch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity_id: opp.id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TrendingDown size={22} className="text-blue" />
          <h1 className="text-[24px] font-bold text-label tracking-tight">Refi Watch</h1>
        </div>
        <button onClick={runScan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 bg-blue text-white text-sm font-semibold rounded-xl hover:bg-blue/90 transition-colors disabled:opacity-50">
          <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>
      {scanMsg && <p className="text-xs text-label-2">{scanMsg}</p>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Opportunities" value={String(stats.total)} />
        <Stat label="Monthly Savings Potential" value={fmt(stats.totalMonthlySavings)} />
        <Stat label="Avg Rate Spread" value={`${stats.avgSpread}%`} />
        <Stat label="Opportunities Sent" value={String(stats.sent)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-label-3">Loading…</p>
        ) : opps.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-label">No refi opportunities yet</p>
            <p className="text-xs text-label-3 mt-1 max-w-md mx-auto">As you close loans and record each borrower&apos;s original rate and loan amount, Ashley will surface past clients who could save by refinancing at today&apos;s rates. Click <span className="font-semibold">Run Scan</span> to check now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06] bg-bg">
                  {['Borrower', 'Orig. Rate', 'Current', 'Spread', 'Savings/mo', 'Est. Balance', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {opps.map((o) => (
                  <tr key={o.id} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${o.lead_id}`} className="text-sm font-medium text-label hover:text-blue">
                        {o.leads ? `${o.leads.first_name} ${o.leads.last_name}` : 'Lead'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-label-2">{o.original_rate}%</td>
                    <td className="px-4 py-3 text-sm text-label-2">{o.current_market_rate}%</td>
                    <td className="px-4 py-3 text-sm font-medium text-red">−{Number(o.rate_spread).toFixed(3)}%</td>
                    <td className="px-4 py-3 text-sm font-bold text-label">{fmt(o.monthly_savings)}/mo</td>
                    <td className="px-4 py-3 text-sm text-label-2">{o.loan_balance_estimate ? fmt(o.loan_balance_estimate) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize', STATUS_COLORS[o.outreach_status] ?? 'bg-black/[0.06] text-label-2')}>
                        {o.outreach_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => generate(o)} className="text-xs font-semibold text-blue hover:underline mr-3">Generate Message</button>
                      {o.outreach_status === 'pending' && (
                        <button onClick={() => setStatus(o, 'sent')} className="text-xs font-semibold text-label-2 hover:underline">Mark Sent</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Message modal */}
      {modalOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setModalOpp(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-label flex items-center gap-1.5"><Sparkles size={15} className="text-blue" /> Refi Outreach Message</h3>
              <button onClick={() => setModalOpp(null)} className="text-label-3 hover:text-label"><X size={16} /></button>
            </div>
            {generating ? (
              <p className="text-sm text-label-3 py-6 text-center">Generating message…</p>
            ) : (
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm resize-none" />
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { void navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                disabled={!draft}
                className="flex items-center gap-1.5 px-3 py-2 bg-bg text-label-2 text-sm font-medium rounded-xl hover:bg-black/[0.08] transition-colors disabled:opacity-40"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => { void setStatus(modalOpp, 'sent'); setModalOpp(null); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue text-white text-sm font-semibold rounded-xl hover:bg-blue/90 transition-colors"
              >
                Mark as Sent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
      <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[22px] font-bold text-label leading-none">{value}</p>
    </div>
  );
}
