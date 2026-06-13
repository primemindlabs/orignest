'use client';

// Phase 112 — DSCR Investment Analyzer (1–9 unit). Live local compute via the pure
// analyzeDscr; "Save analysis" persists an INSERT-only record. Lender comparison from
// the LO's AE connections. 5–9 unit = small commercial (different thresholds + flags).
import { useMemo, useState, useEffect } from 'react';
import { IconBuildingCommunity, IconAlertTriangle, IconDeviceFloppy, IconCheck } from '@tabler/icons-react';
import { analyzeDscr, type DscrBand } from '@/lib/dscr/analyzer';

const BAND_COLOR: Record<DscrBand, string> = { strong: '#C9A95C', qualifying: '#C27B2A', failing: '#C0000A' };
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-[#C9A95C]/30">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="w-full bg-transparent px-3 py-2 text-sm text-gray-900 focus:outline-none"
        />
        {suffix && <span className="px-2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </label>
  );
}

interface Lender {
  id: string;
  lender_name: string | null;
  ae_name: string | null;
  ae_email: string | null;
  preferred: boolean;
  offers_dscr: boolean;
}

export function DSCRAnalyzer() {
  const [address, setAddress] = useState('');
  const [units, setUnits] = useState('1');
  const [rent, setRent] = useState('3500');
  const [vacancy, setVacancy] = useState('5');
  const [taxes, setTaxes] = useState('400');
  const [insurance, setInsurance] = useState('150');
  const [hoa, setHoa] = useState('0');
  const [mgmt, setMgmt] = useState('8');
  const [maintenance, setMaintenance] = useState('5');
  const [capex, setCapex] = useState('3');
  const [price, setPrice] = useState('500000');
  const [loan, setLoan] = useState('375000');
  const [rate, setRate] = useState('7.625');
  const [term, setTerm] = useState('360');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lenders, setLenders] = useState<Lender[]>([]);

  const n = (v: string, d = 0) => (v.trim() === '' ? d : Number(v) || d);

  const result = useMemo(
    () =>
      analyzeDscr({
        unit_count: Math.min(9, Math.max(1, Math.round(n(units, 1)))),
        gross_monthly_rent: n(rent),
        vacancy_rate_pct: n(vacancy, 5),
        monthly_taxes: n(taxes),
        monthly_insurance: n(insurance),
        monthly_hoa: n(hoa),
        management_pct: n(mgmt, 8),
        maintenance_pct: n(maintenance, 5),
        capex_reserve_pct: n(capex, 3),
        loan_amount: n(loan),
        interest_rate: n(rate),
        loan_term_months: Math.round(n(term, 360)),
      }),
    [units, rent, vacancy, taxes, insurance, hoa, mgmt, maintenance, capex, loan, rate, term]
  );

  useEffect(() => {
    fetch('/api/tools/dscr/lenders')
      .then((r) => (r.ok ? r.json() : { lenders: [] }))
      .then((d) => setLenders(d.lenders ?? []))
      .catch(() => setLenders([]));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/tools/dscr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persist: true,
        property_address: address,
        unit_count: n(units, 1),
        gross_monthly_rent: n(rent),
        vacancy_rate_pct: n(vacancy, 5),
        monthly_taxes: n(taxes),
        monthly_insurance: n(insurance),
        monthly_hoa: n(hoa),
        management_pct: n(mgmt, 8),
        maintenance_pct: n(maintenance, 5),
        capex_reserve_pct: n(capex, 3),
        purchase_price: n(price),
        loan_amount: n(loan),
        interest_rate: n(rate),
        loan_term_months: n(term, 360),
      }),
    }).catch(() => undefined);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const color = BAND_COLOR[result.band];
  const dscrLenders = lenders.filter((l) => l.offers_dscr);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <Field label="Property address" value={address} onChange={setAddress} />
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Units</span>
            <select
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((u) => (
                <option key={u} value={u}>
                  {u} unit{u > 1 ? 's' : ''} {u >= 5 ? '— small commercial' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gross monthly rent" value={rent} onChange={setRent} suffix="$" />
            <Field label="Vacancy" value={vacancy} onChange={setVacancy} suffix="%" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Monthly expenses</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Taxes" value={taxes} onChange={setTaxes} suffix="$" />
            <Field label="Insurance" value={insurance} onChange={setInsurance} suffix="$" />
            <Field label="HOA" value={hoa} onChange={setHoa} suffix="$" />
            <Field label="Management" value={mgmt} onChange={setMgmt} suffix="%" />
            <Field label="Maintenance" value={maintenance} onChange={setMaintenance} suffix="%" />
            <Field label="CapEx reserve" value={capex} onChange={setCapex} suffix="%" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Loan</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase price" value={price} onChange={setPrice} suffix="$" />
            <Field label="Loan amount" value={loan} onChange={setLoan} suffix="$" />
            <Field label="Interest rate" value={rate} onChange={setRate} suffix="%" />
            <Field label="Term (months)" value={term} onChange={setTerm} />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          {result.is_commercial && (
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C27B2A] bg-[#C27B2A]/10 rounded-full px-2.5 py-1 mb-3">
              <IconBuildingCommunity size={12} /> Small commercial (5–9 unit)
            </div>
          )}
          <p className="text-xs text-gray-400">DSCR</p>
          <p className="text-5xl font-bold tabular-nums" style={{ color }}>
            {result.dscr.toFixed(3)}
          </p>
          <p className="text-sm font-medium mt-1" style={{ color }}>
            {result.band === 'strong' ? 'Strong' : result.band === 'qualifying' ? 'Qualifying' : 'Below minimum'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            min {result.minimum_dscr.toFixed(2)} · preferred {result.preferred_dscr.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-700 mb-3">NOI breakdown (monthly)</p>
          <dl className="text-sm divide-y divide-gray-50">
            {[
              ['Effective gross income', usd(result.effective_gross_income)],
              ['– Management', usd(result.management_expense)],
              ['– Maintenance', usd(result.maintenance_expense)],
              ['– CapEx reserve', usd(result.capex_expense)],
              ['– Taxes + insurance + HOA', usd(result.total_operating_expenses - result.management_expense - result.maintenance_expense - result.capex_expense)],
              ['Net operating income', usd(result.net_operating_income)],
              ['Debt service (P&I)', usd(result.monthly_debt_service)],
            ].map(([k, v], i) => (
              <div key={i} className="flex justify-between py-1.5">
                <dt className="text-gray-500">{k}</dt>
                <dd className="font-medium text-gray-900 tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: `${color}40`, background: `${color}0F` }}>
          {!result.qualifies && <IconAlertTriangle size={15} className="inline mr-1.5" style={{ color }} />}
          <span className="text-gray-700">{result.notes}</span>
          {result.is_commercial && (
            <p className="text-xs text-gray-500 mt-2">
              Note: 5–9 unit properties use commercial underwriting — title and appraisal differ from residential.
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C9A95C] py-2.5 text-sm font-semibold text-white hover:brightness-95 transition disabled:opacity-50"
        >
          {saved ? <IconCheck size={15} /> : <IconDeviceFloppy size={15} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save analysis'}
        </button>

        {result.qualifies && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-700 mb-2">DSCR-capable lenders</p>
            {dscrLenders.length === 0 ? (
              <p className="text-xs text-gray-400">No DSCR-tagged AE connections yet. Add AEs under AE Connect.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {dscrLenders.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{l.lender_name ?? 'Lender'}</p>
                      <p className="text-xs text-gray-400 truncate">{l.ae_name ?? ''}</p>
                    </div>
                    {l.ae_email && (
                      <a href={`mailto:${l.ae_email}`} className="text-xs text-[#C9A95C] hover:underline shrink-0">
                        Email AE
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
