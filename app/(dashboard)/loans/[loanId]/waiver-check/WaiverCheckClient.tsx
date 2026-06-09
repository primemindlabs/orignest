'use client';

/** Phase 63.2 — interactive appraisal-waiver pre-check (pure, client-side). */
import { useState, useMemo } from 'react';
import { Check, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { checkWaiverEligibility } from '@/lib/appraisal/waiverDetector';

export function WaiverCheckClient({ defaultLoanType }: { defaultLoanType?: string | null }) {
  const [f, setF] = useState({
    loan_type: defaultLoanType && ['conventional_conforming', 'conventional_jumbo'].includes(defaultLoanType) ? defaultLoanType : 'conventional_conforming',
    loan_purpose: 'purchase', occupancy: 'primary' as 'primary' | 'second_home' | 'investment', ltv: '80',
    prior_appraisal_exists: false, is_manufactured: false, is_coop: false, is_new_construction: false, has_renovation: false,
  });

  const result = useMemo(() => checkWaiverEligibility({ ...f, ltv: Number(f.ltv) || 0 }), [f]);
  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';
  const conf = result.confidence === 'high' ? '#27AE60' : result.confidence === 'medium' ? '#F39C12' : 'var(--c-label2)';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Loan type</span><select value={f.loan_type} onChange={(e) => setF((x) => ({ ...x, loan_type: e.target.value }))} className={inp}>{['conventional_conforming', 'conventional_jumbo', 'fha', 'va', 'usda'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Purpose</span><select value={f.loan_purpose} onChange={(e) => setF((x) => ({ ...x, loan_purpose: e.target.value }))} className={inp}>{['purchase', 'refinance_rate_term', 'refinance_cashout'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Occupancy</span><select value={f.occupancy} onChange={(e) => setF((x) => ({ ...x, occupancy: e.target.value as typeof f.occupancy }))} className={inp}>{['primary', 'second_home', 'investment'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">LTV %</span><input type="number" value={f.ltv} onChange={(e) => setF((x) => ({ ...x, ltv: e.target.value }))} className={inp} /></label>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {([['prior_appraisal_exists', 'Prior appraisal on file'], ['is_manufactured', 'Manufactured home'], ['is_coop', 'Co-op'], ['is_new_construction', 'New construction'], ['has_renovation', 'Renovation loan']] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-[12px] text-[var(--c-text)]"><input type="checkbox" checked={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.checked }))} /> {l}</label>
          ))}
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-2">
          {result.likely_eligible ? <ShieldCheck size={18} className="text-[#27AE60]" /> : <ShieldAlert size={18} className="text-[var(--c-danger)]" />}
          <p className="text-[14px] font-semibold" style={{ color: result.likely_eligible ? '#27AE60' : 'var(--c-danger)' }}>{result.likely_eligible ? 'Likely eligible for PIW/ACE' : 'Full appraisal required'}</p>
          {result.likely_eligible && <span className="ml-auto text-[11px] font-semibold uppercase" style={{ color: conf }}>{result.confidence} confidence</span>}
        </div>
        {result.likely_eligible && <p className="text-[13px] text-[var(--c-gold-deep)] font-semibold mb-2">Est. savings ${result.estimated_savings}</p>}
        <div className="space-y-1 mb-2">
          {result.criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">{c.pass ? <Check size={13} className="text-[#27AE60]" /> : <X size={13} className="text-[var(--c-danger)]" />}<span className="text-[var(--c-text)]">{c.label}</span></div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--c-label2)] leading-relaxed border-t border-[var(--c-border)] pt-2">{result.recommendation}</p>
      </div>
    </div>
  );
}
