'use client';

// Phase 114 — AI Rate Sheet Parser. Left: parse a pasted rate sheet + active sheets.
// Right: query the best adjusted price for a borrower profile. (PDF auto-parse is gated
// on a pdf-text dependency; paste the rate-sheet text for now.)
import { useEffect, useState, useCallback } from 'react';
import { IconFileText, IconChevronDown, IconSparkles } from '@tabler/icons-react';

interface Sheet {
  id: string;
  lender_name: string;
  effective_date: string;
  expiration_date: string | null;
  loan_types: string[];
  product_count: number;
  expired: boolean;
}
interface Result {
  lender_name: string;
  amortization_type: string;
  base_rate: number;
  base_price: number;
  total_llpa: number;
  adjusted_price: number;
  lock_period_days: number | null;
  applied: { adjuster_name: string; adjustment: number }[];
}

function field(label: string, el: React.ReactNode) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="mt-1">{el}</div>
    </label>
  );
}
const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';

export function RateSheetParser() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [lender, setLender] = useState('');
  const [effective, setEffective] = useState('');
  const [expiration, setExpiration] = useState('');
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [rawJson, setRawJson] = useState<any>(null);
  const [showRaw, setShowRaw] = useState(false);

  const [fico, setFico] = useState('740');
  const [ltv, setLtv] = useState('80');
  const [loanType, setLoanType] = useState('conventional');
  const [term, setTerm] = useState('30');
  const [amount, setAmount] = useState('450000');
  const [purpose, setPurpose] = useState('purchase');
  const [results, setResults] = useState<Result[] | null>(null);
  const [querying, setQuerying] = useState(false);

  const loadSheets = useCallback(async () => {
    const res = await fetch('/api/tools/rate-sheets');
    const d = await res.json();
    setSheets(d.sheets ?? []);
  }, []);
  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  async function parse() {
    setParsing(true);
    setParseMsg(null);
    setRawJson(null);
    try {
      const res = await fetch('/api/tools/rate-sheets/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lenderName: lender, effectiveDate: effective, expirationDate: expiration || null, text }),
      });
      const d = await res.json();
      if (!res.ok) setParseMsg(d.error ?? 'Parse failed');
      else {
        setParseMsg(`Extracted ${d.productsFound} product(s) and ${d.llpasFound} adjuster(s).`);
        setRawJson(d.raw ?? null);
        setText('');
        loadSheets();
      }
    } finally {
      setParsing(false);
    }
  }

  async function query() {
    setQuerying(true);
    setResults(null);
    try {
      const res = await fetch('/api/tools/rate-sheets/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ficoScore: fico, ltv, loanType, termYears: term, loanAmount: amount, loanPurpose: purpose }),
      });
      const d = await res.json();
      setResults(d.results ?? []);
    } finally {
      setQuerying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Parse + sheets */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <IconSparkles size={15} className="text-[#C9A95C]" /> Parse a rate sheet
          </p>
          <div className="grid grid-cols-2 gap-3">
            {field('Lender', <input value={lender} onChange={(e) => setLender(e.target.value)} className={inputCls} placeholder="e.g. UWM" />)}
            {field('Effective date', <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className={inputCls} />)}
          </div>
          {field('Expiration (optional)', <input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} className={inputCls} />)}
          {field(
            'Rate sheet text',
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste the rate sheet pricing grid + adjusters here…"
              className={`${inputCls} resize-none font-mono text-xs`}
            />
          )}
          <button
            onClick={parse}
            disabled={parsing || !lender || !effective || text.trim().length < 40}
            className="w-full rounded-xl bg-[#C9A95C] py-2.5 text-sm font-semibold text-white hover:brightness-95 transition disabled:opacity-50"
          >
            {parsing ? 'Parsing with AI…' : 'Parse rate sheet'}
          </button>
          {parseMsg && <p className="text-xs text-gray-500">{parseMsg}</p>}
          {rawJson && (
            <div className="border border-gray-100 rounded-xl">
              <button onClick={() => setShowRaw((s) => !s)} className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500">
                Verify extraction <IconChevronDown size={13} className={showRaw ? 'rotate-180' : ''} />
              </button>
              {showRaw && <pre className="px-3 pb-3 text-[10px] text-gray-500 overflow-x-auto max-h-48">{JSON.stringify(rawJson, null, 2)}</pre>}
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            PDF auto-parse isn’t enabled (no PDF-text library installed) — paste the rate sheet text. AI extraction is
            imperfect on complex grids; always verify.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Active rate sheets</p>
          {sheets.length === 0 ? (
            <p className="text-xs text-gray-400">None yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {sheets.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                      <IconFileText size={13} className="text-gray-300" /> {s.lender_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Eff {s.effective_date}
                      {s.expiration_date ? ` · exp ${s.expiration_date}` : ''} · {s.product_count} product{s.product_count === 1 ? '' : 's'}
                      {s.expired ? ' · expired' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Query */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Find the best rate</p>
          <div className="grid grid-cols-2 gap-3">
            {field('FICO', <input value={fico} onChange={(e) => setFico(e.target.value)} inputMode="numeric" className={inputCls} />)}
            {field('LTV %', <input value={ltv} onChange={(e) => setLtv(e.target.value)} inputMode="decimal" className={inputCls} />)}
            {field(
              'Loan type',
              <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className={`${inputCls} bg-white`}>
                {['conventional', 'fha', 'va', 'dscr', 'jumbo'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            {field(
              'Term (yrs)',
              <select value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputCls} bg-white`}>
                {[30, 20, 15, 10].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            {field('Loan amount', <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={inputCls} />)}
            {field(
              'Purpose',
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${inputCls} bg-white`}>
                {['purchase', 'rate_term_refi', 'cash_out'].map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button onClick={query} disabled={querying} className="w-full rounded-xl bg-[#C9A95C] py-2.5 text-sm font-semibold text-white hover:brightness-95 transition disabled:opacity-50">
            {querying ? 'Searching…' : 'Find best rate'}
          </button>
        </div>

        {results && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Results ({results.length})</p>
            {results.length === 0 ? (
              <p className="text-xs text-gray-400">No matching products in your active rate sheets.</p>
            ) : (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${i === 0 ? 'border-[#C9A95C] bg-[#C9A95C]/5' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{r.lender_name}</p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{r.base_rate.toFixed(3)}%</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span>
                        {r.amortization_type.replace(/_/g, ' ')} · {r.lock_period_days ?? 30}d lock
                      </span>
                      <span>
                        price {r.adjusted_price.toFixed(3)}{' '}
                        <span className={r.total_llpa < 0 ? 'text-red-500' : 'text-green-600'}>({r.total_llpa >= 0 ? '+' : ''}{r.total_llpa.toFixed(3)} LLPA)</span>
                      </span>
                    </div>
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
