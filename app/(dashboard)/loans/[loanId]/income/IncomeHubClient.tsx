'use client';

/** Phase 53.8 — Income Calculator Hub: summary + saved calcs + a field-driven
 * calculator covering every income type (server computes the authoritative result). */
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Calculator } from 'lucide-react';
import { INCOME_TYPE_LABELS } from '@/lib/income/calculators';

type FieldKind = 'number' | 'date' | 'check' | 'select';
interface Field { key: string; label: string; kind?: FieldKind; options?: string[] }

const FORMS: Record<string, Field[]> = {
  w2_salary: [
    { key: 'ytd_earnings', label: 'YTD gross earnings' }, { key: 'ytd_as_of_date', label: 'Pay stub date', kind: 'date' },
    { key: 'prior_year_w2', label: 'Prior-year W-2 (box 1)' }, { key: 'two_years_prior_w2', label: '2-years-prior W-2' },
    { key: 'is_new_job', label: 'New job (<2 yrs)', kind: 'check' }, { key: 'employment_gap_months', label: 'Employment gap (months)' },
  ],
  w2_hourly: [
    { key: 'ytd_earnings', label: 'YTD gross earnings' }, { key: 'ytd_as_of_date', label: 'Pay stub date', kind: 'date' },
    { key: 'prior_year_w2', label: 'Prior-year W-2 (box 1)' }, { key: 'is_new_job', label: 'New job (<2 yrs)', kind: 'check' },
  ],
  self_employed_sole_prop: [
    { key: 'year1', label: 'Year 1' }, { key: 'y1_net_profit_loss', label: 'Y1 net profit/loss (Sch C ln 31)' },
    { key: 'y1_depreciation', label: 'Y1 depreciation' }, { key: 'y1_depletion', label: 'Y1 depletion' },
    { key: 'y1_business_use_of_home', label: 'Y1 business use of home' }, { key: 'y1_meals_50pct_not_deductible', label: 'Y1 non-deductible meals' },
    { key: 'has_year2', label: 'Have year 2?', kind: 'check' }, { key: 'year2', label: 'Year 2' },
    { key: 'y2_net_profit_loss', label: 'Y2 net profit/loss' }, { key: 'y2_depreciation', label: 'Y2 depreciation' },
    { key: 'years_self_employed', label: 'Years self-employed' }, { key: 'business_ownership_pct', label: 'Ownership %' },
    { key: 'is_business_still_operating', label: 'Still operating?', kind: 'check' },
  ],
  self_employed_scorp: [
    { key: 'y1_w2_wages', label: 'Y1 W-2 wages from S-Corp' }, { key: 'y1_ordinary_income', label: 'Y1 ordinary income (1120S ln 21)' },
    { key: 'y1_depreciation', label: 'Y1 depreciation' }, { key: 'y1_amortization', label: 'Y1 amortization' },
    { key: 'ownership_pct', label: 'Ownership %' }, { key: 'has_year2', label: 'Have year 2?', kind: 'check' },
    { key: 'y2_w2_wages', label: 'Y2 W-2 wages' }, { key: 'y2_ordinary_income', label: 'Y2 ordinary income' }, { key: 'years_self_employed', label: 'Years self-employed' },
  ],
  rental_schedule_e: [
    { key: 'is_subject_property', label: 'Subject property?', kind: 'check' }, { key: 'monthly_market_rent', label: 'Monthly market rent (subject)' },
    { key: 'gross_rents_received', label: 'Gross rents received (Sch E ln 3)' }, { key: 'net_income_loss', label: 'Net income/loss (Sch E ln 26)' },
    { key: 'depreciation', label: 'Depreciation (ln 18)' }, { key: 'mortgage_interest', label: 'Mortgage interest (ln 12)' }, { key: 'other_interest', label: 'Other interest (ln 13)' },
  ],
  social_security: [
    { key: 'monthly_gross_amount', label: 'Monthly gross amount' }, { key: 'is_taxable', label: 'Taxable?', kind: 'check' },
    { key: 'has_award_letter', label: 'Award letter verified?', kind: 'check' }, { key: 'years_remaining', label: 'Years remaining (if defined)' },
  ],
  pension: [
    { key: 'monthly_gross_amount', label: 'Monthly gross amount' }, { key: 'is_taxable', label: 'Taxable?', kind: 'check' }, { key: 'years_remaining', label: 'Years remaining' },
  ],
  bonus_commission: [
    { key: 'income_subtype', label: 'Type', kind: 'select', options: ['bonus', 'commission', 'overtime', 'tips', 'shift_differential'] },
    { key: 'prior_year_amount', label: 'Prior-year amount' }, { key: 'current_ytd', label: 'Current YTD' }, { key: 'ytd_as_of_date', label: 'YTD as-of date', kind: 'date' },
    { key: 'trend', label: 'Trend', kind: 'select', options: ['increasing', 'stable', 'declining'] }, { key: 'employer_states_likely_to_continue', label: 'Employer confirms continuance?', kind: 'check' },
  ],
  other_employment: [
    { key: 'income_subtype', label: 'Type', kind: 'select', options: ['bonus', 'commission', 'overtime'] }, { key: 'prior_year_amount', label: 'Prior-year amount' },
    { key: 'current_ytd', label: 'Current YTD' }, { key: 'ytd_as_of_date', label: 'YTD as-of date', kind: 'date' }, { key: 'trend', label: 'Trend', kind: 'select', options: ['increasing', 'stable', 'declining'] }, { key: 'employer_states_likely_to_continue', label: 'Continuance confirmed?', kind: 'check' },
  ],
};

const usd = (n: number) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface Calc { id: string; income_type: string; borrower_type: string; calculated_income: number; fannie_income: number | null; freddie_income: number | null; calculation_notes: string | null; created_at: string }

export function IncomeHubClient({ leadId }: { leadId: string }) {
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<string>('w2_salary');
  const [borrower, setBorrower] = useState<'primary' | 'co_borrower'>('primary');
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/income-calculations?lead_id=${leadId}`);
    if (r.ok) setCalcs((await r.json()).calculations ?? []);
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    try {
      let input_data: Record<string, unknown> = vals;
      if (type === 'rental_schedule_e') input_data = { properties: [vals] };
      const r = await fetch('/api/income-calculations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, borrower_type: borrower, income_type: type, input_data }) });
      if (r.ok) { setAdding(false); setVals({}); await load(); }
    } finally { setBusy(false); }
  }

  const primary = calcs.filter((c) => c.borrower_type === 'primary');
  const co = calcs.filter((c) => c.borrower_type === 'co_borrower');
  const sum = (a: Calc[]) => a.reduce((s, c) => s + Number(c.calculated_income), 0);
  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[['Primary borrower', sum(primary)], ['Co-borrower', sum(co)], ['Combined monthly', sum(calcs)]].map(([l, v]) => (
          <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] mb-1">{l}</p><p className="text-[18px] font-bold font-mono tabular-nums text-[var(--c-text)]">{usd(Number(v))}<span className="text-[11px] text-[var(--c-label2)] font-sans">/mo</span></p></div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[var(--c-label2)]">{calcs.length} income source{calcs.length === 1 ? '' : 's'}</p>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><Plus size={13} /> Add income</button>
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Income type</span><select value={type} onChange={(e) => { setType(e.target.value); setVals({}); }} className={inp}>{Object.keys(FORMS).map((t) => <option key={t} value={t}>{INCOME_TYPE_LABELS[t]}</option>)}</select></label>
            <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Borrower</span><select value={borrower} onChange={(e) => setBorrower(e.target.value as 'primary' | 'co_borrower')} className={inp}><option value="primary">Primary</option><option value="co_borrower">Co-borrower</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(FORMS[type] ?? []).map((f) => (
              <label key={f.key} className={`block ${f.kind === 'check' ? 'flex items-center gap-2 mt-1.5' : ''}`}>
                {f.kind === 'check' ? (
                  <><input type="checkbox" checked={Boolean(vals[f.key])} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.checked }))} /><span className="text-[12px] text-[var(--c-text)]">{f.label}</span></>
                ) : f.kind === 'select' ? (
                  <><span className="text-[11px] text-[var(--c-label2)]">{f.label}</span><select value={String(vals[f.key] ?? f.options?.[0] ?? '')} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className={inp}>{f.options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}</select></>
                ) : (
                  <><span className="text-[11px] text-[var(--c-label2)]">{f.label}</span><input type={f.kind === 'date' ? 'date' : 'number'} value={String(vals[f.key] ?? '')} onChange={(e) => setVals((v) => ({ ...v, [f.key]: f.kind === 'date' ? e.target.value : (e.target.value === '' ? undefined : Number(e.target.value)) }))} className={inp} /></>
                )}
              </label>
            ))}
          </div>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60"><Calculator size={14} /> {busy ? 'Calculating…' : 'Calculate & save'}</button>
        </div>
      )}

      <div className="space-y-2">
        {calcs.map((c) => (
          <div key={c.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--c-fill)]">
              <div className="text-left"><p className="text-[13px] font-semibold text-[var(--c-text)]">{INCOME_TYPE_LABELS[c.income_type] ?? c.income_type}<span className="text-[11px] text-[var(--c-label2)] font-normal"> · {c.borrower_type.replace('_', '-')}</span></p><p className="text-[11px] text-[var(--c-label2)]">{new Date(c.created_at).toLocaleDateString()}</p></div>
              <div className="flex items-center gap-3"><p className="text-[16px] font-bold font-mono text-[var(--c-gold-deep)]">{usd(c.calculated_income)}<span className="text-[10px] text-[var(--c-label2)] font-sans">/mo</span></p><ChevronDown size={15} className={`text-[var(--c-label2)] ${open === c.id ? 'rotate-180' : ''}`} /></div>
            </button>
            {open === c.id && c.calculation_notes && (
              <div className="border-t border-[var(--c-border)] px-4 py-3 bg-[var(--c-bg)]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-1">Calculation notes</p>
                <pre className="text-[12px] text-[var(--c-text)] whitespace-pre-wrap font-sans leading-relaxed">{c.calculation_notes}</pre>
                {c.fannie_income != null && c.freddie_income != null && c.fannie_income !== c.freddie_income && (
                  <div className="grid grid-cols-2 gap-2 mt-2"><div className="text-center bg-[var(--c-surface)] rounded p-2"><p className="text-[10px] text-[var(--c-label2)]">Fannie</p><p className="font-mono text-[13px] text-[var(--c-text)]">{usd(c.fannie_income)}/mo</p></div><div className="text-center bg-[var(--c-surface)] rounded p-2"><p className="text-[10px] text-[var(--c-label2)]">Freddie</p><p className="font-mono text-[13px] text-[var(--c-text)]">{usd(c.freddie_income)}/mo</p></div></div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
