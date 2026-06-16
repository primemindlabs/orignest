'use client';

import { useState, useMemo } from 'react';
import { Scale, Info } from 'lucide-react';
import { TRID_EXEMPT_NOTE } from '@/lib/compliance/tridExempt';

// TRID tolerance buckets. The calculator compares LE vs CD per line and computes
// the lender cure owed when a charge exceeds its allowed tolerance.
type Bucket = 'zero' | 'ten' | 'none';
interface Line { key: string; label: string; bucket: Bucket; le: string; cd: string }

const BUCKET_LABEL: Record<Bucket, string> = { zero: '0% tolerance', ten: '10% cumulative', none: 'No tolerance' };
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// Consumer TRID line set, adapted to the loan program. Government programs add a
// no-tolerance financed fee (VA funding fee / FHA UFMIP / USDA guarantee fee).
function consumerLines(program: string): Line[] {
  const base: Line[] = [
    { key: 'origination', label: 'Origination charges', bucket: 'zero', le: '', cd: '' },
    { key: 'transfer_tax', label: 'Transfer taxes', bucket: 'zero', le: '', cd: '' },
    { key: 'cant_shop', label: 'Services you cannot shop for', bucket: 'zero', le: '', cd: '' },
  ];
  const govFee: Record<string, { key: string; label: string }> = {
    VA: { key: 'va_funding_fee', label: 'VA funding fee' },
    FHA: { key: 'fha_ufmip', label: 'FHA upfront MIP (UFMIP)' },
    USDA: { key: 'usda_guarantee_fee', label: 'USDA guarantee fee' },
  };
  const gov = govFee[program];
  const govLine: Line[] = gov ? [{ key: gov.key, label: gov.label, bucket: 'none', le: '', cd: '' }] : [];
  const rest: Line[] = [
    { key: 'recording', label: 'Recording fees', bucket: 'ten', le: '', cd: '' },
    { key: 'can_shop_onlist', label: 'Services you can shop for (lender list)', bucket: 'ten', le: '', cd: '' },
    { key: 'prepaid_interest', label: 'Prepaid interest / escrow', bucket: 'none', le: '', cd: '' },
    { key: 'insurance', label: 'Homeowners insurance', bucket: 'none', le: '', cd: '' },
  ];
  return [...base, ...govLine, ...rest];
}

// Business-purpose settlement reconciliation: no TRID tolerance regime, so this is
// an informational Estimated-vs-Final worksheet (no lender cure).
function exemptLines(): Line[] {
  return [
    { key: 'origination', label: 'Origination / points', bucket: 'none', le: '', cd: '' },
    { key: 'broker', label: 'Broker fee', bucket: 'none', le: '', cd: '' },
    { key: 'title', label: 'Title & escrow', bucket: 'none', le: '', cd: '' },
    { key: 'recording', label: 'Recording & transfer', bucket: 'none', le: '', cd: '' },
    { key: 'prepaids', label: 'Prepaids & reserves', bucket: 'none', le: '', cd: '' },
    { key: 'other', label: 'Other settlement charges', bucket: 'none', le: '', cd: '' },
  ];
}

interface Props {
  borrowerName: string;
  programLabel: string;
  loanProgram: string;
  exempt: boolean;
}

export function CdBalancerClient({ borrowerName, programLabel, loanProgram, exempt }: Props) {
  const [lines, setLines] = useState<Line[]>(() => (exempt ? exemptLines() : consumerLines(loanProgram)));

  function set(key: string, field: 'le' | 'cd', value: string) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  // Consumer mode: TRID tolerance cure.
  const cure = useMemo(() => {
    let zeroCure = 0;
    let tenLe = 0, tenCd = 0;
    for (const l of lines) {
      const le = Number(l.le) || 0;
      const cd = Number(l.cd) || 0;
      if (l.bucket === 'zero' && cd > le) zeroCure += cd - le;
      if (l.bucket === 'ten') { tenLe += le; tenCd += cd; }
    }
    const tenAllowed = tenLe * 1.1;
    const tenCure = tenCd > tenAllowed ? tenCd - tenAllowed : 0;
    return { zeroCure, tenCure, total: zeroCure + tenCure, tenLe, tenCd, tenAllowed };
  }, [lines]);

  // Exempt mode: simple Estimated-vs-Final reconciliation.
  const recon = useMemo(() => {
    let est = 0, fin = 0;
    for (const l of lines) { est += Number(l.le) || 0; fin += Number(l.cd) || 0; }
    return { est, fin, diff: fin - est };
  }, [lines]);

  const leLabel = exempt ? 'Estimated' : 'LE';
  const cdLabel = exempt ? 'Final' : 'CD';

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-[var(--c-label2)]" />
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">CD Balancer</h1>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--c-fill)] text-[var(--c-label2)]">{programLabel}</span>
      </div>
      <p className="text-[13px] text-[var(--c-label2)]">
        {borrowerName ? `${borrowerName} · ` : ''}
        {exempt
          ? 'Reconcile estimated vs final settlement charges for this business-purpose file.'
          : 'Compare Loan Estimate vs Closing Disclosure charges. Tolerance violations compute the lender cure owed.'}
      </p>

      {exempt && (
        <div className="flex items-start gap-2 bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[12px] px-4 py-3">
          <Info size={15} className="text-[var(--c-label2)] flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--c-label2)] leading-relaxed">{TRID_EXEMPT_NOTE}</p>
        </div>
      )}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-[var(--c-border)] text-[11px] font-semibold text-[var(--c-label3)] uppercase tracking-wide">
          <span>Charge</span><span className="w-24 text-center">{leLabel}</span><span className="w-24 text-center">{cdLabel}</span>
        </div>
        {lines.map((l) => {
          const over = !exempt && l.bucket === 'zero' && (Number(l.cd) || 0) > (Number(l.le) || 0);
          return (
            <div key={l.key} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-[var(--c-border)] last:border-0">
              <div>
                <p className="text-[13px] text-[var(--c-text)]">{l.label}</p>
                {!exempt && <span className="text-[10px] text-[var(--c-label3)]">{BUCKET_LABEL[l.bucket]}</span>}
              </div>
              <input type="number" value={l.le} onChange={(e) => set(l.key, 'le', e.target.value)} className="w-24 h-8 rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 text-[13px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30" />
              <input type="number" value={l.cd} onChange={(e) => set(l.key, 'cd', e.target.value)} className="w-24 h-8 rounded-[8px] border px-2 text-[13px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30" style={{ borderColor: over ? 'var(--c-danger)' : 'var(--c-border)' }} />
            </div>
          );
        })}
      </div>

      {exempt ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-2">
          <div className="flex justify-between text-[13px]"><span className="text-[var(--c-label2)]">Total estimated</span><span className="font-mono tabular-nums text-[var(--c-text)]">{fmt(recon.est)}</span></div>
          <div className="flex justify-between text-[13px]"><span className="text-[var(--c-label2)]">Total final</span><span className="font-mono tabular-nums text-[var(--c-text)]">{fmt(recon.fin)}</span></div>
          <div className="flex justify-between text-[15px] font-semibold pt-2 border-t border-[var(--c-border)]">
            <span className="text-[var(--c-text)]">Net change at closing</span>
            <span className="font-mono tabular-nums" style={{ color: recon.diff > 0 ? 'var(--c-danger)' : 'var(--c-success)' }}>{recon.diff >= 0 ? '+' : ''}{fmt(recon.diff)}</span>
          </div>
          <p className="text-[12px] text-[var(--c-label3)]">No TRID tolerance cure applies to a business-purpose loan — this is an informational reconciliation.</p>
        </div>
      ) : (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-2">
          <div className="flex justify-between text-[13px]"><span className="text-[var(--c-label2)]">0% bucket cure</span><span className="font-mono tabular-nums text-[var(--c-text)]">{fmt(cure.zeroCure)}</span></div>
          <div className="flex justify-between text-[13px]"><span className="text-[var(--c-label2)]">10% bucket cure ({fmt(cure.tenCd)} vs {fmt(cure.tenAllowed)} allowed)</span><span className="font-mono tabular-nums text-[var(--c-text)]">{fmt(cure.tenCure)}</span></div>
          <div className="flex justify-between text-[15px] font-semibold pt-2 border-t border-[var(--c-border)]">
            <span className="text-[var(--c-text)]">Total lender cure owed</span>
            <span className="font-mono tabular-nums" style={{ color: cure.total > 0 ? 'var(--c-danger)' : 'var(--c-success)' }}>{fmt(cure.total)}</span>
          </div>
          {cure.total === 0 && <p className="text-[12px] text-[var(--c-success)]">✓ All charges within TRID tolerance.</p>}
        </div>
      )}
    </div>
  );
}
