'use client';

/** Phase 59.4/59.6 — live DTI calculator + AI pre-submission review. */
import { useState, useMemo } from 'react';
import { Sparkles, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { calculateDTI } from '@/lib/calculations/dti';

const TIER = { green: '#27AE60', amber: '#F39C12', red: 'var(--c-danger)' } as const;
const SEV_ICON = { blocking: AlertTriangle, warning: AlertCircle, info: Info } as const;
const SEV_COLOR = { blocking: 'var(--c-danger)', warning: '#F39C12', info: 'var(--c-label2)' } as const;

interface Cond { trigger: string; severity: 'blocking' | 'warning' | 'info'; section: string; message: string }
interface Review { red_flags: { issue: string; severity: string; recommendation: string }[]; missing_docs: { document: string; reason: string }[]; ready_to_submit: boolean; summary_notes: string }

export function SmartCheckClient({ loanId }: { loanId: string }) {
  const [f, setF] = useState({ pi: '', taxes: '', insurance: '', hoa: '', mip: '', income: '', otherDebt: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ conditions: Cond[]; ready: boolean; ai_review: Review | null; ai_gated: boolean } | null>(null);

  const n = (v: string) => Number(v) || 0;
  const dti = useMemo(() => calculateDTI(
    { principal_interest: n(f.pi), taxes: n(f.taxes), insurance: n(f.insurance), hoa: n(f.hoa), mip_pmi: n(f.mip) },
    n(f.otherDebt) > 0 ? [{ creditor_name: 'Other debts', monthly_payment: n(f.otherDebt), unpaid_balance: 0, liability_type: 'installment', omit_from_dti: false, is_deferred: false } as never] : [],
    n(f.income),
  ), [f]);

  async function review() {
    setBusy(true);
    try {
      const app = { loan_id: loanId, liabilities_data: { liabilities: [], total_monthly_debt: dti.total_debt, back_end_dti: dti.back_end, front_end_dti: dti.front_end }, income_data: { total_qualifying_income_monthly: n(f.income) } };
      const r = await fetch(`/api/loans/${loanId}/application-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ application: app }) });
      if (r.ok) setResult(await r.json());
    } finally { setBusy(false); }
  }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';
  const usd = (x: number) => x.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
        <p className="text-[12px] font-semibold text-[var(--c-text)] mb-1">Housing (PITI)</p>
        <div className="grid grid-cols-2 gap-2">
          {([['pi', 'Principal & interest'], ['taxes', 'Property taxes'], ['insurance', 'Insurance'], ['hoa', 'HOA'], ['mip', 'MIP / PMI']] as const).map(([k, l]) => (
            <label key={k} className="block"><span className="text-[11px] text-[var(--c-label2)]">{l}</span><input type="number" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={inp} /></label>
          ))}
        </div>
        <p className="text-[12px] font-semibold text-[var(--c-text)] mt-2 mb-1">Income & debts</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Gross monthly income</span><input type="number" value={f.income} onChange={(e) => setF((x) => ({ ...x, income: e.target.value }))} className={inp} /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Other monthly debts</span><input type="number" value={f.otherDebt} onChange={(e) => setF((x) => ({ ...x, otherDebt: e.target.value }))} className={inp} /></label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">Front-end (housing)</p><p className="text-[26px] font-bold font-mono" style={{ color: TIER[dti.front_tier] }}>{dti.front_end}%</p><p className="text-[11px] text-[var(--c-label2)]">PITI {usd(dti.piti)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">Back-end (total)</p><p className="text-[26px] font-bold font-mono" style={{ color: TIER[dti.back_tier] }}>{dti.back_end}%</p><p className="text-[11px] text-[var(--c-label2)]">Obligations {usd(dti.total_debt)}</p></div>
          </div>
          <button onClick={review} disabled={busy || !f.income} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60"><Sparkles size={14} /> {busy ? 'Reviewing…' : 'Run pre-submission review'}</button>
        </div>

        {result && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
            <p className="text-[13px] font-semibold" style={{ color: result.ready ? '#27AE60' : 'var(--c-danger)' }}>{result.ready ? '✓ Ready to submit' : '✗ Not ready — resolve blocking items'}</p>
            {result.conditions.map((c) => { const Icon = SEV_ICON[c.severity]; return <div key={c.trigger} className="flex items-start gap-2"><Icon size={13} className="mt-0.5 flex-shrink-0" style={{ color: SEV_COLOR[c.severity] }} /><p className="text-[12px] text-[var(--c-text)]">{c.message}</p></div>; })}
            {result.ai_gated && <p className="text-[11px] text-[var(--c-label2)] italic">AI underwriter review unavailable (ANTHROPIC_API_KEY not set).</p>}
            {result.ai_review?.red_flags?.map((rf, i) => <div key={i} className="flex items-start gap-2"><AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-[#F39C12]" /><p className="text-[12px] text-[var(--c-text)]">{rf.issue} — <span className="text-[var(--c-label2)]">{rf.recommendation}</span></p></div>)}
            {result.ai_review?.missing_docs && result.ai_review.missing_docs.length > 0 && <p className="text-[11px] text-[var(--c-label2)] mt-1">Likely conditions: {result.ai_review.missing_docs.map((m) => m.document).join(', ')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
