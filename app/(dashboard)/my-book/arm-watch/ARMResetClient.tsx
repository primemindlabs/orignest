'use client';

/** Phase 62.3 — ARM Reset Watch dashboard: upcoming resets by urgency + outreach. */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Phone, TrendingUp } from 'lucide-react';

interface Watch { id: string; borrower_name: string; loan_balance: number | null; current_rate: number; days_to_reset: number; urgency: string; projected_rate: number; payment_increase: number; alert_status: string }
interface Summary { total: number; resets_this_quarter: number; est_revenue_opportunity: number }
const URG_COLOR: Record<string, string> = { HIGH: 'var(--c-danger)', MEDIUM: '#F39C12', WATCH: 'var(--c-label2)', PAST: 'var(--c-danger)' };
const usd = (n: number) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ARMResetClient() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ borrower_name: '', loan_balance: '', current_rate: '', arm_margin: '', arm_initial_cap: '2', arm_lifetime_cap: '5', first_reset_date: '' });

  const load = useCallback(async () => { const r = await fetch('/api/arm-watches'); if (r.ok) { const d = await r.json(); setWatches(d.watches ?? []); setSummary(d.summary); } }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const r = await fetch('/api/arm-watches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, loan_balance: Number(f.loan_balance) || 0, current_rate: Number(f.current_rate), arm_margin: Number(f.arm_margin) || 0, arm_initial_cap: Number(f.arm_initial_cap), arm_lifetime_cap: Number(f.arm_lifetime_cap) }) });
    if (r.ok) { setAdding(false); setF({ borrower_name: '', loan_balance: '', current_rate: '', arm_margin: '', arm_initial_cap: '2', arm_lifetime_cap: '5', first_reset_date: '' }); load(); }
  }
  async function act(id: string, alert_status: string) { const r = await fetch('/api/arm-watches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, alert_status }) }); const d = await r.json(); if (d.lead_id) window.location.href = `/leads/${d.lead_id}`; else load(); }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {[['ARM loans watched', String(summary.total)], ['Resets this quarter', String(summary.resets_this_quarter)], ['Est. revenue opportunity', usd(summary.est_revenue_opportunity)]].map(([l, v]) => (
            <div key={l} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">{l}</p><p className="text-[18px] font-bold text-[var(--c-text)] mt-0.5">{v}</p></div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Upcoming resets</p>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline"><Plus size={12} /> Add ARM loan</button>
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3 grid grid-cols-3 gap-2">
          <label className="block col-span-2"><span className="text-[11px] text-[var(--c-label2)]">Borrower name</span><input value={f.borrower_name} onChange={(e) => setF((x) => ({ ...x, borrower_name: e.target.value }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">First reset</span><input type="date" value={f.first_reset_date} onChange={(e) => setF((x) => ({ ...x, first_reset_date: e.target.value }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Balance</span><input type="number" value={f.loan_balance} onChange={(e) => setF((x) => ({ ...x, loan_balance: e.target.value }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Current rate %</span><input type="number" value={f.current_rate} onChange={(e) => setF((x) => ({ ...x, current_rate: e.target.value }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Margin %</span><input type="number" value={f.arm_margin} onChange={(e) => setF((x) => ({ ...x, arm_margin: e.target.value }))} className={inp} /></label>
          <button onClick={add} disabled={!f.borrower_name || !f.current_rate || !f.first_reset_date} className="col-span-3 h-8 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Add</button>
        </div>
      )}

      {watches.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No ARM loans watched yet. Add existing borrowers with adjustable-rate loans to catch resets before they hit.</p> : (
        <div className="space-y-2">
          {watches.map((w) => (
            <div key={w.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--c-text)]">{w.borrower_name} <span className="text-[11px] font-bold uppercase ml-1" style={{ color: URG_COLOR[w.urgency] }}>{w.urgency}</span></p>
                  <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Resets in {w.days_to_reset}d · {w.current_rate}% → <span className="text-[var(--c-text)] font-medium">{w.projected_rate}%</span> · <span style={{ color: 'var(--c-danger)' }}>+{usd(w.payment_increase)}/mo</span>{w.loan_balance ? ` · ${usd(Number(w.loan_balance))} balance` : ''}</p>
                </div>
                <TrendingUp size={16} className="text-[var(--c-label2)] flex-shrink-0" />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => act(w.id, 'refi_started')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium bg-[var(--c-gold)] text-white">Start refi</button>
                <button onClick={() => act(w.id, 'outreach_in_progress')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><Phone size={11} /> Outreach</button>
                <button onClick={() => act(w.id, 'not_interested')} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium border border-[var(--c-border)] text-[var(--c-label2)]">Not interested</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[var(--c-label2)] italic">Projections use a fallback index; connect a live SOFR/Treasury feed for exact reset rates.</p>
    </div>
  );
}
