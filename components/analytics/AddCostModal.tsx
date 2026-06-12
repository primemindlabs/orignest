'use client';

/** Phase 98 — add / manage referral source cost entries. */
import { useState, useEffect, useCallback } from 'react';
import { IconX, IconListDetails } from '@tabler/icons-react';
import { SourceBadge } from '@/components/leads/SourceBadge';
import { SOURCE_OPTIONS } from '@/lib/analytics/sources';
import { formatUSD } from '@/lib/analytics/roi';
import type { ReferralSourceCost } from '@/types/analytics';

const GOLD = '#C9A95C';
const PERIODS: { v: 'monthly' | 'per_lead' | 'one_time'; l: string }[] = [
  { v: 'monthly', l: 'Monthly (prorated across period)' },
  { v: 'per_lead', l: 'Per Lead (multiplied by lead count)' },
  { v: 'one_time', l: 'One-Time (full amount)' },
];
const today = () => new Date().toISOString().slice(0, 10);

export function AddCostModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [sourceType, setSourceType] = useState('realtor');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'per_lead' | 'one_time'>('monthly');
  const [activeFrom, setActiveFrom] = useState(today());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [costs, setCosts] = useState<ReferralSourceCost[]>([]);

  const isOrganic = sourceType === 'organic';
  const field = 'w-full h-9 px-3 rounded-[10px] text-sm bg-white border border-[var(--c-border)] text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[#C9A95C]';

  const loadCosts = useCallback(async () => {
    const res = await fetch('/api/analytics/referral-costs');
    if (res.ok) setCosts((await res.json()).data ?? []);
  }, []);
  useEffect(() => { loadCosts(); }, [loadCosts]);
  useEffect(() => { if (isOrganic) setAmount('0'); }, [isOrganic]);

  async function submit() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch('/api/analytics/referral-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          source_detail: detail.trim() || null,
          cost_amount: isOrganic ? 0 : Number(amount),
          cost_period: period,
          active_from: activeFrom,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Could not save.'); return; }
      if (d.closed_previous_at) setNote(`A previous active entry for this source was closed on ${d.closed_previous_at}.`);
      setDetail(''); setAmount(isOrganic ? '0' : '');
      await loadCosts();
      onSaved();
    } finally { setBusy(false); }
  }

  async function endEntry(id: string) {
    await fetch('/api/analytics/referral-costs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await loadCosts();
    onSaved();
  }

  const active = costs.filter((c) => !c.active_to);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold text-gray-900">Manage source costs</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IconX size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-gray-500 mb-1 block">Source type</label>
            <select className={field} value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-gray-500 mb-1 block">Source detail (optional)</label>
            <input className={field} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Jane Smith, Summer Campaign" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-gray-500 mb-1 block">Cost amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input className={`${field} pl-6`} type="number" step="0.01" min="0" value={amount} disabled={isOrganic} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-gray-500 mb-1 block">Cost period</label>
            <div className="space-y-1.5">
              {PERIODS.map((p) => (
                <label key={p.v} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="period" checked={period === p.v} onChange={() => setPeriod(p.v)} /> {p.l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-gray-500 mb-1 block">Active from</label>
            <input className={field} type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
          </div>

          {err && <p className="text-[12px] text-red-600">{err}</p>}
          {note && <p className="text-[12px] text-[#8A6310]">{note}</p>}
          <button onClick={submit} disabled={busy} className="h-9 px-4 rounded-[10px] text-sm font-medium text-white w-full disabled:opacity-50" style={{ background: GOLD }}>
            {busy ? 'Saving…' : 'Save cost entry'}
          </button>
        </div>

        {/* Active entries */}
        <div className="mt-6">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5"><IconListDetails size={14} /> Active cost entries</p>
          {active.length === 0 ? (
            <p className="text-[13px] text-gray-400">None yet.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
              {active.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SourceBadge source={c.source_type} size="sm" />
                    <span className="text-xs text-gray-700 truncate">{c.source_detail ?? 'All'} · {formatUSD(c.cost_amount)} {c.cost_period.replace('_', '-')}</span>
                  </div>
                  <button onClick={() => endEntry(c.id)} className="text-xs font-medium text-gray-500 hover:text-red-600 flex-shrink-0">End</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
