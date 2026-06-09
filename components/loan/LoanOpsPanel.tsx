'use client';

/** Phase 52.5/52.8/52.3/52.6 — closing & operations: EMD, MERS (channel-gated),
 * first-payment details, and a lock-desk request. */
import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { validateMERSMin } from '@/lib/compliance/mersMin';

interface Initial {
  emd_amount?: number | null; emd_due_date?: string | null; emd_received_date?: string | null;
  mers_min?: string | null; mers_status?: string | null;
  first_payment_date?: string | null; monthly_payment_amount?: number | null; loan_servicer_name?: string | null;
}

function emdStatus(i: { emd_amount?: number | null; emd_due_date?: string | null; emd_received_date?: string | null }): { label: string; color: string } {
  if (!i.emd_amount) return { label: 'Not set', color: 'var(--c-label2)' };
  if (i.emd_received_date) return { label: 'Received', color: '#27AE60' };
  if (i.emd_due_date && new Date(i.emd_due_date) < new Date()) return { label: 'Overdue', color: 'var(--c-danger)' };
  return { label: 'Pending', color: '#F39C12' };
}

export function LoanOpsPanel({ leadId, channel, initial }: { leadId: string; channel: string | null; initial: Initial }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const showMers = channel === 'direct_lender' || channel === 'correspondent';
  const mersBad = !!f.mers_min && !validateMERSMin(String(f.mers_min));

  async function save(extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/loans/${leadId}/ops`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, ...extra }) });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); if (extra?.confirm_emd) setF((x) => ({ ...x, emd_received_date: new Date().toISOString().slice(0, 10) })); }
    } finally { setBusy(false); }
  }
  async function requestLock() {
    setLockBusy(true);
    try { await fetch('/api/rate-lock-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, request_type: 'new_lock', requested_lock_days: 30 }) }); } finally { setLockBusy(false); }
  }

  const st = emdStatus(f);
  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-4">
      {/* EMD */}
      <div>
        <div className="flex items-center justify-between mb-1.5"><p className="text-[12px] font-semibold text-[var(--c-text)]">Earnest money (EMD)</p><span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: 'var(--c-fill)' }}>{st.label}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Amount</span><input type="number" value={f.emd_amount ?? ''} onChange={(e) => setF((x) => ({ ...x, emd_amount: e.target.value === '' ? null : Number(e.target.value) }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Due date</span><input type="date" value={f.emd_due_date ?? ''} onChange={(e) => setF((x) => ({ ...x, emd_due_date: e.target.value || null }))} className={inp} /></label>
        </div>
        {!f.emd_received_date && f.emd_amount ? <button onClick={() => save({ confirm_emd: true })} disabled={busy} className="mt-1.5 text-[12px] text-[var(--c-gold-deep)] hover:underline">✓ Confirm EMD received</button> : null}
      </div>

      {showMers && (
        <div>
          <p className="text-[12px] font-semibold text-[var(--c-text)] mb-1.5">MERS</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">MIN (18 digits)</span><input value={f.mers_min ?? ''} onChange={(e) => setF((x) => ({ ...x, mers_min: e.target.value }))} className={inp} style={mersBad ? { borderColor: 'var(--c-danger)' } : undefined} /></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Status</span><select value={f.mers_status ?? ''} onChange={(e) => setF((x) => ({ ...x, mers_status: e.target.value || null }))} className={inp}><option value="">—</option>{['pending', 'registered', 'transferred', 'deactivated'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </div>
          {mersBad && <p className="text-[11px] text-[var(--c-danger)] mt-1">MERS MIN must be exactly 18 digits.</p>}
        </div>
      )}

      {/* Post-close */}
      <div>
        <p className="text-[12px] font-semibold text-[var(--c-text)] mb-1.5">Post-close</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">First payment</span><input type="date" value={f.first_payment_date ?? ''} onChange={(e) => setF((x) => ({ ...x, first_payment_date: e.target.value || null }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Monthly payment</span><input type="number" value={f.monthly_payment_amount ?? ''} onChange={(e) => setF((x) => ({ ...x, monthly_payment_amount: e.target.value === '' ? null : Number(e.target.value) }))} className={inp} /></label>
          <label className="block col-span-2"><span className="text-[11px] text-[var(--c-label2)]">Servicer</span><input value={f.loan_servicer_name ?? ''} onChange={(e) => setF((x) => ({ ...x, loan_servicer_name: e.target.value || null }))} placeholder="e.g. Mr. Cooper" className={inp} /></label>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => save()} disabled={busy || mersBad} className="inline-flex items-center gap-1.5 h-8 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">{saved ? <><Check size={13} /> Saved</> : busy ? 'Saving…' : 'Save'}</button>
        <button onClick={requestLock} disabled={lockBusy} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><Lock size={12} /> {lockBusy ? 'Requesting…' : 'Request rate lock (30d)'}</button>
      </div>
    </div>
  );
}
