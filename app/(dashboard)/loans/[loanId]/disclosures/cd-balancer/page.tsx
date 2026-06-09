'use client';

import { useState, useMemo } from 'react';
import { Scale } from 'lucide-react';

// TRID tolerance buckets. The calculator compares LE vs CD per line and computes
// the lender cure owed when a charge exceeds its allowed tolerance.
type Bucket = 'zero' | 'ten' | 'none';
interface Line { key: string; label: string; bucket: Bucket; le: string; cd: string }

const INITIAL: Line[] = [
  { key: 'origination', label: 'Origination charges', bucket: 'zero', le: '', cd: '' },
  { key: 'transfer_tax', label: 'Transfer taxes', bucket: 'zero', le: '', cd: '' },
  { key: 'cant_shop', label: 'Services you cannot shop for', bucket: 'zero', le: '', cd: '' },
  { key: 'recording', label: 'Recording fees', bucket: 'ten', le: '', cd: '' },
  { key: 'can_shop_onlist', label: 'Services you can shop for (lender list)', bucket: 'ten', le: '', cd: '' },
  { key: 'prepaid_interest', label: 'Prepaid interest / escrow', bucket: 'none', le: '', cd: '' },
  { key: 'insurance', label: 'Homeowners insurance', bucket: 'none', le: '', cd: '' },
];

const BUCKET_LABEL: Record<Bucket, string> = { zero: '0% tolerance', ten: '10% cumulative', none: 'No tolerance' };
const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function CdBalancerPage() {
  const [lines, setLines] = useState<Line[]>(INITIAL);

  function set(key: string, field: 'le' | 'cd', value: string) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  const result = useMemo(() => {
    let zeroCure = 0;
    let tenLe = 0, tenCd = 0;
    for (const l of lines) {
      const le = Number(l.le) || 0;
      const cd = Number(l.cd) || 0;
      if (l.bucket === 'zero' && cd > le) zeroCure += cd - le;
      if (l.bucket === 'ten') { tenLe += le; tenCd += cd; }
    }
    // 10% cumulative: cure only if CD total exceeds LE total by more than 10%.
    const tenAllowed = tenLe * 1.1;
    const tenCure = tenCd > tenAllowed ? tenCd - tenAllowed : 0;
    return { zeroCure, tenCure, total: zeroCure + tenCure, tenLe, tenCd, tenAllowed };
  }, [lines]);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-[var(--c-label2)]" />
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">CD Balancer</h1>
      </div>
      <p className="text-[13px] text-[var(--c-label2)]">
        Compare Loan Estimate vs Closing Disclosure charges. Tolerance violations compute the lender cure owed.
      </p>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-[var(--c-border)] text-[11px] font-semibold text-[var(--c-label3)] uppercase tracking-wide">
          <span>Charge</span><span className="w-24 text-center">LE</span><span className="w-24 text-center">CD</span>
        </div>
        {lines.map((l) => {
          const over = l.bucket === 'zero' && (Number(l.cd) || 0) > (Number(l.le) || 0);
          return (
            <div key={l.key} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-[var(--c-border)] last:border-0">
              <div>
                <p className="text-[13px] text-[var(--c-text)]">{l.label}</p>
                <span className="text-[10px] text-[var(--c-label3)]">{BUCKET_LABEL[l.bucket]}</span>
              </div>
              <input type="number" value={l.le} onChange={(e) => set(l.key, 'le', e.target.value)} className="w-24 h-8 rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 text-[13px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30" />
              <input type="number" value={l.cd} onChange={(e) => set(l.key, 'cd', e.target.value)} className="w-24 h-8 rounded-[8px] border px-2 text-[13px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30" style={{ borderColor: over ? 'var(--c-danger)' : 'var(--c-border)' }} />
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-2">
        <div className="flex justify-between text-[13px]"><span className="text-[var(--c-label2)]">0% bucket cure</span><span className="font-mono tabular-nums text-[var(--c-text)]">{fmt(result.zeroCure)}</span></div>
        <div className="flex justify-between text-[13px]"><span className="text-[var(--c-label2)]">10% bucket cure ({fmt(result.tenCd)} vs {fmt(result.tenAllowed)} allowed)</span><span className="font-mono tabular-nums text-[var(--c-text)]">{fmt(result.tenCure)}</span></div>
        <div className="flex justify-between text-[15px] font-semibold pt-2 border-t border-[var(--c-border)]">
          <span className="text-[var(--c-text)]">Total lender cure owed</span>
          <span className="font-mono tabular-nums" style={{ color: result.total > 0 ? 'var(--c-danger)' : 'var(--c-success)' }}>{fmt(result.total)}</span>
        </div>
        {result.total === 0 && <p className="text-[12px] text-[var(--c-success)]">✓ All charges within TRID tolerance.</p>}
      </div>
    </div>
  );
}
