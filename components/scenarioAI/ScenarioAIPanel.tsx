'use client';

/** Phase 44.4/44.5 — Scenario AI: who can do this deal? Pre-filled from the loan,
 * quick-pick hard cases, Claude Sonnet analysis + matched lenders from the matrix. */
import { useState } from 'react';
import { Target, X, Copy, Check, RotateCcw } from 'lucide-react';

interface Inputs {
  fico_score?: number; loan_type?: string; purpose?: string; loan_amount?: number;
  property_value?: number; ltv?: number; dscr_ratio?: number; income_type?: string;
  property_type?: string; is_non_warrantable?: boolean; occupancy?: string; state?: string;
  has_bk_history?: boolean;
}
interface Lender { id: string; lender_name: string; lender_type: string; ae_name?: string | null; ae_phone?: string | null }

const QUICK_PICKS = [
  { key: 'dscr_below_1', label: '📊 DSCR < 1.0', o: { loan_type: 'dscr', income_type: 'dscr', dscr_ratio: 0.92 } },
  { key: 'self_employed_loss', label: '📋 Self-employed / loss', o: { loan_type: 'non_qm_bank_stmt', income_type: 'self_employed_bank_stmt' } },
  { key: 'non_warrantable_condo', label: '🏢 Non-warrantable condo', o: { property_type: 'condo', is_non_warrantable: true } },
  { key: 'fha_after_bk', label: '⚖️ FHA after BK', o: { loan_type: 'fha', has_bk_history: true } },
  { key: 'va_low_fico', label: '🎖️ VA low FICO', o: { loan_type: 'va', fico_score: 580 } },
  { key: 'itin', label: '🌎 ITIN', o: { loan_type: 'non_qm_itin', income_type: 'itin' } },
  { key: 'asset_depletion', label: '💰 Asset depletion', o: { loan_type: 'non_qm_asset_depletion', income_type: 'asset_depletion' } },
  { key: 'commercial_bridge', label: '🌉 Commercial bridge', o: { loan_type: 'commercial_bridge' } },
] as const;

const NUM: { key: keyof Inputs; label: string }[] = [
  { key: 'fico_score', label: 'FICO' }, { key: 'loan_amount', label: 'Loan amount' },
  { key: 'property_value', label: 'Property value' }, { key: 'dscr_ratio', label: 'DSCR ratio' },
];

export function ScenarioAIPanel({ leadId, initial }: { leadId: string; initial: Inputs }) {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Inputs>(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ analysis_text: string; matched_lenders: Lender[]; general_recommendation: string } | null>(null);
  const [quickKey, setQuickKey] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  async function run() {
    setBusy(true); setResult(null);
    const ltv = inputs.loan_amount && inputs.property_value ? inputs.loan_amount / inputs.property_value : inputs.ltv;
    try {
      const res = await fetch('/api/scenario/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, inputs: { ...inputs, ltv }, scenario_type: quickKey ? 'quick_pick' : 'full_analysis', quick_pick_key: quickKey }) });
      const d = await res.json();
      if (res.ok) setResult(d);
      else setResult({ analysis_text: d.error ?? 'Could not analyze.', matched_lenders: [], general_recommendation: '' });
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium border border-[var(--c-gold)]/40 text-[var(--c-gold-deep)] hover:bg-[var(--c-gold-light)] transition-colors">
        <Target size={14} /> Scenario AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-lg h-full bg-[var(--c-bg)] border-l border-[var(--c-border)] shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[var(--c-bg)] border-b border-[var(--c-border)] px-5 py-3.5 flex items-center gap-2">
              <Target size={15} className="text-[var(--c-gold-deep)]" />
              <p className="text-[14px] font-semibold text-[var(--c-text)] flex-1">Scenario AI · who can do this deal?</p>
              <button onClick={() => setOpen(false)} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--c-label2)] mb-2">Quick scenarios</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PICKS.map((q) => (
                    <button key={q.key} onClick={() => { setInputs((p) => ({ ...p, ...q.o })); setQuickKey(q.key); }} className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${quickKey === q.key ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)] hover:border-[var(--c-gold)]'}`}>{q.label}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {NUM.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[11px] text-[var(--c-label2)]">{f.label}</span>
                    <input type="number" value={(inputs[f.key] as number) ?? ''} step={f.key === 'dscr_ratio' ? 0.01 : 1} onChange={(e) => setInputs((p) => ({ ...p, [f.key]: e.target.value === '' ? undefined : parseFloat(e.target.value) }))} className="w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)] focus:outline-none focus:border-[var(--c-gold)]" />
                  </label>
                ))}
                <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Loan type</span>
                  <input value={inputs.loan_type ?? ''} onChange={(e) => setInputs((p) => ({ ...p, loan_type: e.target.value }))} className="w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]" /></label>
                <label className="block"><span className="text-[11px] text-[var(--c-label2)]">State</span>
                  <input value={inputs.state ?? ''} maxLength={2} onChange={(e) => setInputs((p) => ({ ...p, state: e.target.value.toUpperCase() }))} className="w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]" /></label>
              </div>

              {!result ? (
                <button onClick={run} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 disabled:opacity-60">
                  <Target size={14} /> {busy ? 'Analyzing scenario…' : 'Find lender matches'}
                </button>
              ) : (
                <div className="space-y-3">
                  {result.matched_lenders.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Your lenders that fit</p>
                      {result.matched_lenders.map((l) => (
                        <div key={l.id} className="flex items-start gap-2.5 p-3 rounded-[10px] bg-[var(--c-gold-light)] border border-[var(--c-gold)]/30 mb-2">
                          <Check size={15} className="text-[var(--c-gold-deep)] mt-0.5" />
                          <div><p className="text-[13px] font-semibold text-[var(--c-text)]">{l.lender_name}</p>{l.ae_name && <p className="text-[11px] text-[var(--c-label2)]">AE: {l.ae_name}{l.ae_phone ? ` · ${l.ae_phone}` : ''}</p>}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-1.5">Analysis</p>
                    <p className="text-[13px] text-[var(--c-text)] whitespace-pre-wrap leading-relaxed">{result.analysis_text}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(result.analysis_text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]">{copied ? <Check size={13} /> : <Copy size={13} />} Copy</button>
                    <button onClick={() => { setResult(null); setQuickKey(undefined); }} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><RotateCcw size={13} /> New scenario</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
