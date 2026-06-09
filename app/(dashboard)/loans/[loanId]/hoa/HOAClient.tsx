'use client';

/** Phase 64.2 — HOA warrantability: questionnaire + live report. */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { assessWarrantability } from '@/lib/hoa/warrantability';

const NUMS: [string, string][] = [['total_units', 'Total units'], ['owner_occupancy_pct', 'Owner-occupancy %'], ['single_investor_pct', 'Single-investor %'], ['commercial_space_pct', 'Commercial space %'], ['reserve_pct_of_budget', 'Reserve % of budget'], ['delinquency_pct_30_plus', 'Delinquency 30+ %'], ['special_assessment_amount', 'Special assessment $']];
const BOOLS: [string, string][] = [['hazard_insurance_adequate', 'Hazard insurance adequate'], ['flood_insurance_required', 'Flood insurance required'], ['flood_insurance_obtained', 'Flood insurance obtained'], ['fidelity_bond_obtained', 'Fidelity bond obtained'], ['pending_litigation', 'Pending litigation'], ['litigation_insurance_covered', 'Litigation insured'], ['construction_defect_litigation', 'Construction-defect litigation'], ['pending_special_assessment', 'Special assessment pending'], ['physical_deficiencies', 'Physical deficiencies']];
const STATUS: Record<string, { label: string; color: string }> = { warrantable: { label: 'Warrantable', color: '#27AE60' }, conditional: { label: 'Conditional', color: '#F39C12' }, non_warrantable: { label: 'Non-Warrantable', color: 'var(--c-danger)' }, review_needed: { label: 'Review needed', color: 'var(--c-label2)' } };

export function HOAClient({ loanId }: { loanId: string }) {
  const [q, setQ] = useState<Record<string, unknown>>({ project_type: 'condo' });
  const [saved, setSaved] = useState(false);
  const result = useMemo(() => assessWarrantability(q), [q]);

  const load = useCallback(async () => { const r = await fetch(`/api/loans/${loanId}/hoa`); if (r.ok) { const d = await r.json(); if (d.questionnaire) setQ(d.questionnaire); } }, [loanId]);
  useEffect(() => { load(); }, [load]);

  async function save() { const r = await fetch(`/api/loans/${loanId}/hoa`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) }); if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); } }
  const set = (k: string, v: unknown) => setQ((x) => ({ ...x, [k]: v }));
  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';
  const s = STATUS[result.status] ?? STATUS.review_needed;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Project type</span><select value={String(q.project_type ?? 'condo')} onChange={(e) => set('project_type', e.target.value)} className={inp}><option value="condo">Condo</option><option value="pud">PUD</option><option value="co_op">Co-op</option></select></label>
        <div className="grid grid-cols-2 gap-2">
          {NUMS.map(([k, l]) => <label key={k} className="block"><span className="text-[11px] text-[var(--c-label2)]">{l}</span><input type="number" value={String(q[k] ?? '')} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} className={inp} /></label>)}
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {BOOLS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-[12px] text-[var(--c-text)]"><input type="checkbox" checked={Boolean(q[k])} onChange={(e) => set(k, e.target.checked)} /> {l}</label>)}
        </div>
        <button onClick={save} className="inline-flex items-center gap-1.5 h-8 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white mt-1">{saved ? 'Saved' : 'Save & assess'}</button>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck size={18} style={{ color: s.color }} /><p className="text-[15px] font-bold" style={{ color: s.color }}>{s.label}</p></div>
        {result.disqualifying_factors.length > 0 && <div><p className="text-[11px] font-semibold uppercase text-[var(--c-danger)] mb-1">Disqualifying ({result.disqualifying_factors.length})</p>{result.disqualifying_factors.map((d, i) => <p key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--c-text)]"><X size={12} className="text-[var(--c-danger)] mt-0.5 flex-shrink-0" /> {d}</p>)}</div>}
        {result.conditional_factors.length > 0 && <div><p className="text-[11px] font-semibold uppercase text-[#B45309] mb-1">Conditional ({result.conditional_factors.length})</p>{result.conditional_factors.map((d, i) => <p key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--c-text)]"><AlertTriangle size={12} className="text-[#F39C12] mt-0.5 flex-shrink-0" /> {d}</p>)}</div>}
        {result.passed_criteria.length > 0 && <div><p className="text-[11px] font-semibold uppercase text-[#27AE60] mb-1">Passed ({result.passed_criteria.length})</p>{result.passed_criteria.map((d, i) => <p key={i} className="flex items-start gap-1.5 text-[12px] text-[var(--c-label2)]"><Check size={12} className="text-[#27AE60] mt-0.5 flex-shrink-0" /> {d}</p>)}</div>}
        {result.lender_options.length > 0 && <div className="border-t border-[var(--c-border)] pt-2"><p className="text-[11px] font-semibold uppercase text-[var(--c-label2)] mb-1">If non-warrantable, consider</p>{result.lender_options.map((o, i) => <p key={i} className="text-[12px] text-[var(--c-gold-deep)]">• {o}</p>)}</div>}
      </div>
    </div>
  );
}
