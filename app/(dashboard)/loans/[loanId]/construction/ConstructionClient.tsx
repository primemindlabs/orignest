'use client';

/** Phase 63.3 — Construction loan: project overview + draw schedule + docs. */
import { useState, useEffect, useCallback } from 'react';
import { Hammer, Check, Clock } from 'lucide-react';

interface CL { id: string; close_type: string; construction_phase_status: string; builder_name: string | null; lot_value: number | null; construction_cost: number | null; total_project_cost: number | null; construction_loan_amount: number | null; total_draws_disbursed: number | null }
interface Draw { id: string; draw_number: number; draw_name: string; percentage_complete: number; budgeted_amount: number; status: string; disbursed_amount: number | null }
interface Doc { id: string; doc_type: string; doc_name: string; status: string }

const usd = (n: number | null) => (n == null ? '—' : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
const DRAW_STATUS: Record<string, { label: string; color: string }> = { scheduled: { label: 'Scheduled', color: 'var(--c-label2)' }, requested: { label: 'Requested', color: '#F39C12' }, inspection_ordered: { label: 'Inspection ordered', color: '#F39C12' }, inspection_complete: { label: 'Inspected', color: '#F39C12' }, approved: { label: 'Approved', color: '#27AE60' }, disbursed: { label: 'Disbursed', color: '#27AE60' }, disputed: { label: 'Disputed', color: 'var(--c-danger)' } };

export function ConstructionClient({ loanId }: { loanId: string }) {
  const [cl, setCl] = useState<CL | null>(null);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ close_type: 'one_time_close', builder_name: '', project_address: '', lot_value: '', construction_cost: '', construction_loan_amount: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => { const r = await fetch(`/api/loans/${loanId}/construction`); if (r.ok) { const d = await r.json(); setCl(d.construction_loan); setDraws(d.draws ?? []); setDocs(d.docs ?? []); } setLoading(false); }, [loanId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const r = await fetch(`/api/loans/${loanId}/construction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, lot_value: Number(f.lot_value) || 0, construction_cost: Number(f.construction_cost) || 0, construction_loan_amount: Number(f.construction_loan_amount) || 0 }) });
    if (r.ok) load();
  }
  async function drawAction(draw_id: string, action: string) { setMsg(null); const r = await fetch(`/api/loans/${loanId}/construction`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draw_id, action }) }); const d = await r.json(); if (r.ok) load(); else setMsg(d.error); }
  async function docAction(doc_id: string, doc_status: string) { await fetch(`/api/loans/${loanId}/construction`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_id, doc_status }) }); load(); }

  if (loading) return <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>;
  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  if (!cl) return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
      <p className="text-[13px] text-[var(--c-label2)] mb-1">Set up a construction loan for this file.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Close type</span><select value={f.close_type} onChange={(e) => setF((x) => ({ ...x, close_type: e.target.value }))} className={inp}><option value="one_time_close">One-time close (OTC)</option><option value="two_time_close">Two-time close (TTC)</option></select></label>
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Builder</span><input value={f.builder_name} onChange={(e) => setF((x) => ({ ...x, builder_name: e.target.value }))} className={inp} /></label>
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Lot value</span><input type="number" value={f.lot_value} onChange={(e) => setF((x) => ({ ...x, lot_value: e.target.value }))} className={inp} /></label>
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Construction cost</span><input type="number" value={f.construction_cost} onChange={(e) => setF((x) => ({ ...x, construction_cost: e.target.value }))} className={inp} /></label>
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Loan amount</span><input type="number" value={f.construction_loan_amount} onChange={(e) => setF((x) => ({ ...x, construction_loan_amount: e.target.value }))} className={inp} /></label>
      </div>
      <button onClick={create} disabled={!f.construction_cost} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60"><Hammer size={14} /> Create + seed draw schedule</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[13px] font-semibold text-[var(--c-text)] mb-2">{cl.close_type === 'one_time_close' ? 'One-Time-Close' : 'Two-Time-Close'}{cl.builder_name ? ` · ${cl.builder_name}` : ''}</p>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[['Lot', cl.lot_value], ['Construction', cl.construction_cost], ['Total project', cl.total_project_cost], ['Loan amount', cl.construction_loan_amount]].map(([l, v]) => (
            <div key={String(l)}><p className="text-[10px] uppercase text-[var(--c-label3)]">{l}</p><p className="text-[13px] font-semibold text-[var(--c-text)]">{usd(v as number | null)}</p></div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--c-label2)] mt-2">Disbursed {usd(cl.total_draws_disbursed)} of {usd(cl.construction_cost)}</p>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Draw schedule</p>
        <div className="space-y-2">
          {draws.map((d) => { const s = DRAW_STATUS[d.status] ?? DRAW_STATUS.scheduled; return (
            <div key={d.id} className="flex items-center justify-between bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] px-3 py-2.5">
              <div><p className="text-[13px] font-medium text-[var(--c-text)]">#{d.draw_number} {d.draw_name} <span className="text-[11px] text-[var(--c-label2)]">· {d.percentage_complete}% complete · {usd(d.budgeted_amount)}</span></p><p className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</p></div>
              <div className="flex gap-1.5">
                {d.status === 'scheduled' && <button onClick={() => drawAction(d.id, 'request')} className="h-7 px-2.5 rounded-btn text-[11px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]">Request</button>}
                {(d.status === 'requested' || d.status === 'inspection_ordered' || d.status === 'inspection_complete' || d.status === 'approved') && <button onClick={() => drawAction(d.id, 'approve')} className="h-7 px-2.5 rounded-btn text-[11px] font-medium bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]">Approve + disburse</button>}
                {d.status === 'disbursed' && <Check size={15} className="text-[#27AE60]" />}
              </div>
            </div>
          ); })}
        </div>
        {msg && <p className="text-[12px] text-[var(--c-danger)] mt-2">{msg}</p>}
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Documents</p>
        <div className="grid grid-cols-2 gap-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[8px] px-3 py-2">
              <span className="text-[12px] text-[var(--c-text)] inline-flex items-center gap-1.5">{doc.status === 'approved' ? <Check size={12} className="text-[#27AE60]" /> : <Clock size={12} className="text-[var(--c-label2)]" />} {doc.doc_name}</span>
              {doc.status !== 'approved' && <button onClick={() => docAction(doc.id, 'approved')} className="text-[11px] text-[var(--c-gold-deep)] hover:underline">Mark received</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
