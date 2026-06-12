'use client';

/**
 * Phase 91 — per-loan comp / BPS take-home calculator. Pre-fills from the LO's saved
 * comp plan, allows per-loan overrides, computes live (PURE lib), and saves an
 * INSERT-only snapshot. Internal LO-only surface (loan detail; never the borrower
 * portal). Reg Z: BPS-on-loan-amount or flat fee only.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Calculator, Save, Check } from 'lucide-react';
import { computeComp, type CompType } from '@/lib/comp/calc';

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CompCalculator({ loanId, loanAmount }: { loanId: string; loanAmount: number | null }) {
  const [open, setOpen] = useState(true);
  const [compType, setCompType] = useState<CompType>('bps');
  const [amount, setAmount] = useState<number>(loanAmount ?? 0);
  const [bps, setBps] = useState<number>(100);
  const [flatFee, setFlatFee] = useState<number>(0);
  const [branchSplit, setBranchSplit] = useState<number>(0);
  const [processorFee, setProcessorFee] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Seed from the LO's saved plan + any prior saved estimate for this loan.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [planRes, estRes] = await Promise.all([
        fetch('/api/comp/plan').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/loans/${loanId}/comp`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!alive) return;
      const plan = planRes?.plan;
      if (plan) {
        setCompType(plan.comp_type === 'flat_fee' ? 'flat_fee' : 'bps');
        if (plan.bps_rate != null) setBps(Number(plan.bps_rate));
        if (plan.flat_fee_amount != null) setFlatFee(Number(plan.flat_fee_amount));
        setBranchSplit(Number(plan.branch_split_pct ?? 0));
        setProcessorFee(Number(plan.processor_fee ?? 0));
      }
      const est = estRes?.estimate;
      if (est) setSavedAt(est.computed_at);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [loanId]);

  const result = useMemo(
    () => computeComp({ loanAmount: amount, compType, bpsRate: bps, flatFee, branchSplitPct: branchSplit, processorFee }),
    [amount, compType, bps, flatFee, branchSplit, processorFee],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/comp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comp_type: compType, loan_amount: amount, bps_rate: bps, flat_fee_amount: flatFee, branch_split_pct: branchSplit, processor_fee: processorFee }),
      });
      if (res.ok) { const d = await res.json(); setSavedAt(d.estimate?.computed_at ?? new Date().toISOString()); }
    } finally { setSaving(false); }
  }, [loanId, compType, amount, bps, flatFee, branchSplit, processorFee]);

  const numField = (label: string, value: number, set: (n: number) => void, opts?: { suffix?: string; prefix?: string; step?: number }) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-[var(--c-text)]">{label}</span>
      <span className="inline-flex items-center gap-1">
        {opts?.prefix && <span className="text-[12px] text-[var(--c-label2)]">{opts.prefix}</span>}
        <input
          type="number" step={opts?.step ?? 1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => set(parseFloat(e.target.value) || 0)}
          className="w-28 text-right text-[13px] font-mono rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1 text-[var(--c-text)] focus:outline-none focus:border-[var(--c-gold)]"
        />
        {opts?.suffix && <span className="text-[12px] text-[var(--c-label2)]">{opts.suffix}</span>}
      </span>
    </label>
  );

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--c-text)]">
          <Calculator size={15} className="text-[var(--c-gold-deep)]" /> My Comp on This Loan
        </span>
        <span className="flex items-center gap-2">
          {loaded && <span className="text-[15px] font-bold text-[var(--c-gold-deep)]">{money(result.netComp)}</span>}
          <ChevronDown size={16} className={`text-[var(--c-label2)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--c-border)] pt-3">
          {/* Comp type */}
          <div className="flex items-center gap-1.5">
            {(['bps', 'flat_fee'] as CompType[]).map((t) => (
              <button key={t} onClick={() => setCompType(t)} className={`text-[12px] px-2.5 py-1 rounded-full border ${compType === t ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>
                {t === 'bps' ? 'BPS' : 'Flat fee'}
              </button>
            ))}
          </div>

          {numField('Loan amount', amount, setAmount, { prefix: '$' })}
          {compType === 'bps'
            ? numField('Comp rate', bps, setBps, { suffix: 'BPS' })
            : numField('Flat fee', flatFee, setFlatFee, { prefix: '$' })}
          {numField('Branch split', branchSplit, setBranchSplit, { suffix: '%' })}
          {numField('Processor fee', processorFee, setProcessorFee, { prefix: '$' })}

          {/* Breakdown */}
          <div className="rounded-[12px] bg-[var(--c-fill)] p-3 space-y-1.5 text-[13px]">
            <Row label={`Gross comp${compType === 'bps' ? ` (${result.effectiveBps} BPS)` : ''}`} value={money(result.grossComp)} />
            <Row label="− Branch split" value={`(${money(result.branchSplitAmount)})`} muted />
            <Row label="− Processor fee" value={`(${money(result.processorDeduction)})`} muted />
            <div className="border-t border-[var(--c-border)] pt-1.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--c-text)]">Net take-home</span>
              <span className="text-[22px] font-bold text-[var(--c-gold-deep)] font-mono">{money(result.netComp)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[var(--c-label3)] max-w-[60%] leading-snug">Internal estimate only — comp keys on loan amount (Reg Z). Never shown to borrowers.</p>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-[12px] text-white rounded-[8px] px-3 py-1.5 disabled:opacity-50" style={{ background: 'var(--c-gold)' }}>
              {savedAt ? <Check size={13} /> : <Save size={13} />} {saving ? 'Saving…' : savedAt ? 'Saved' : 'Save estimate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-[var(--c-label2)]' : 'text-[var(--c-text)]'}>{label}</span>
      <span className={`font-mono ${muted ? 'text-[var(--c-label2)]' : 'text-[var(--c-text)]'}`}>{value}</span>
    </div>
  );
}
