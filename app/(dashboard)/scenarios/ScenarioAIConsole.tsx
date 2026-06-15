'use client';

/**
 * Phase 138 — Scenario AI console (vicario-style). Describe a borrower scenario in
 * plain English (optionally enrich with a few structured fields) → Claude Sonnet
 * analyzes it against the org's live lender matrix and returns which lenders can
 * close the deal and why, plus guideline risks and next steps.
 */
import { useState } from 'react';
import { Sparkles, Loader2, Phone, Mail, Building2, ArrowRight, Lightbulb } from 'lucide-react';

interface MatchedLender {
  id: string; lender_name: string; lender_type: string;
  ae_name?: string | null; ae_email?: string | null; ae_phone?: string | null; notes?: string | null;
}
interface Result { analysis_text: string; matched_lenders: MatchedLender[]; general_recommendation: string }

const EXAMPLES = [
  'Self-employed borrower, 2 yrs 1099, 700 FICO, wants cash-out refi on a primary in TX, ~65% LTV.',
  'Investor buying a 4-unit in FL, 720 FICO, qualifying on rents — DSCR ~1.15, 25% down.',
  'First-time buyer, 640 FICO, 5% down on a $450k single-family primary, W-2, 44% DTI.',
  'Foreign national, no US credit, 40% down on a condo in Miami, bank-statement income.',
];

const INCOME_TYPES = [
  { v: '', l: 'Income type' },
  { v: 'w2', l: 'W-2' },
  { v: 'self_employed_bank_stmt', l: 'Bank statement' },
  { v: 'self_employed_1099', l: '1099' },
  { v: 'dscr', l: 'DSCR (rents)' },
  { v: 'asset_depletion', l: 'Asset depletion' },
  { v: 'itin', l: 'ITIN' },
];
const PURPOSES = [{ v: '', l: 'Purpose' }, { v: 'purchase', l: 'Purchase' }, { v: 'rate_term', l: 'Rate/term refi' }, { v: 'cash_out', l: 'Cash-out refi' }];
const OCC = [{ v: '', l: 'Occupancy' }, { v: 'primary', l: 'Primary' }, { v: 'second_home', l: 'Second home' }, { v: 'investment', l: 'Investment' }];

// Lightweight renderer for the analysis markdown (bold + bullets, no extra deps).
function Analysis({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-label">
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1.5" />;
        const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        const isHeading = /^\*\*.+\*\*$/.test(line) || /^#{1,3}\s/.test(line);
        const isBullet = /^[-*•]\s/.test(line);
        if (isHeading) return <p key={i} className="text-[13px] font-bold text-label mt-2.5" dangerouslySetInnerHTML={{ __html: html.replace(/^#{1,3}\s/, '') }} />;
        if (isBullet) return <div key={i} className="flex gap-2"><span className="text-gold-600 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: html.replace(/^[-*•]\s/, '') }} /></div>;
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export function ScenarioAIConsole() {
  const [text, setText] = useState('');
  const [fico, setFico] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [ltv, setLtv] = useState('');
  const [incomeType, setIncomeType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [occupancy, setOccupancy] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!text.trim() && !fico && !loanAmount) {
      setError('Describe the scenario (or fill a few fields) to analyze.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const inputs = {
        free_text: text.trim() || undefined,
        fico_score: fico ? Number(fico) : undefined,
        loan_amount: loanAmount ? Number(loanAmount.replace(/[^0-9.]/g, '')) : undefined,
        ltv: ltv ? Number(ltv) / 100 : undefined,
        income_type: incomeType || undefined,
        purpose: purpose || undefined,
        occupancy: occupancy || undefined,
        state: state || undefined,
      };
      const res = await fetch('/api/scenario/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, scenario_type: 'console' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Analysis failed.');
      setResult(j as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  const field = 'rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[13px] text-label focus:outline-none focus:border-gold-400';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
      {/* ── Ask ── */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gold-50 flex items-center justify-center"><Sparkles size={16} className="text-gold-600" /></div>
          <div>
            <h2 className="text-[15px] font-semibold text-label leading-tight">Describe the scenario</h2>
            <p className="text-[12px] text-label-3">Plain English — Ashley matches it to your lenders & guidelines.</p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="e.g. Self-employed borrower, 2 years 1099, 700 FICO, wants a cash-out refi on a primary in Texas around 65% LTV…"
          className="w-full rounded-xl border border-black/[0.1] bg-fill px-3.5 py-3 text-[13.5px] text-label leading-relaxed focus:outline-none focus:border-gold-400 resize-none"
        />

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="text-[11px] text-label-2 bg-fill hover:bg-black/[0.06] rounded-full px-2.5 py-1 text-left">
              {ex.length > 48 ? ex.slice(0, 46) + '…' : ex}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input value={fico} onChange={(e) => setFico(e.target.value)} inputMode="numeric" placeholder="FICO" className={field} />
          <input value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} inputMode="numeric" placeholder="Loan $" className={field} />
          <input value={ltv} onChange={(e) => setLtv(e.target.value)} inputMode="numeric" placeholder="LTV %" className={field} />
          <select value={incomeType} onChange={(e) => setIncomeType(e.target.value)} className={field}>{INCOME_TYPES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={field}>{PURPOSES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
          <select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className={field}>{OCC.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
        </div>
        <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="State (e.g. TX)" className={`${field} mt-2 w-28`} />

        {error && <p className="text-[12px] text-red mt-3">{error}</p>}

        <button onClick={analyze} disabled={loading} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-gold-600 text-white text-sm font-semibold rounded-xl hover:bg-gold-700 transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Analyzing…' : 'Analyze scenario'}
        </button>
      </div>

      {/* ── Answer ── */}
      <div className="space-y-3">
        {!result && !loading && (
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-8 text-center">
            <Lightbulb size={22} className="text-gold-500 mx-auto mb-2" />
            <p className="text-[13px] text-label-2">Ashley reads your lender matrix and tells you <span className="font-semibold text-label">who can close this deal</span> — with the overlay that makes them a fit, guideline risks, and a restructure if it unlocks more options.</p>
          </div>
        )}
        {loading && (
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-8 text-center text-label-3 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Matching lenders & guidelines…
          </div>
        )}
        {result && (
          <>
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
              <div className="flex items-center gap-1.5 mb-3 text-[12px] font-semibold uppercase tracking-wide text-label-3">
                <Sparkles size={13} className="text-gold-600" /> Analysis
              </div>
              <Analysis text={result.analysis_text} />
            </div>

            {result.matched_lenders.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-label-3 mb-3">Matched lenders ({result.matched_lenders.length})</p>
                <div className="space-y-2.5">
                  {result.matched_lenders.map((l) => (
                    <div key={l.id} className="rounded-xl border border-black/[0.06] p-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-gold-600" />
                        <span className="text-[14px] font-semibold text-label">{l.lender_name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-label-3 bg-fill rounded-full px-1.5 py-0.5">{l.lender_type}</span>
                      </div>
                      {l.notes && <p className="text-[12px] text-label-2 mt-1.5">{l.notes}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {l.ae_phone && <a href={`tel:${l.ae_phone}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-gold-700 hover:text-gold-800"><Phone size={12} /> {l.ae_name ?? 'AE'} · {l.ae_phone}</a>}
                        {l.ae_email && <a href={`mailto:${l.ae_email}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-label-2 hover:text-label"><Mail size={12} /> Email</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.general_recommendation && (
              <div className="flex items-start gap-2 rounded-xl border border-gold-100 bg-gold-50 px-3.5 py-3 text-[12.5px] text-gold-800">
                <ArrowRight size={14} className="flex-shrink-0 mt-0.5" /> {result.general_recommendation}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
