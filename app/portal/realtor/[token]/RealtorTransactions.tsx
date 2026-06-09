'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Txn {
  id: string;
  borrower: string;
  address: string | null;
  stage: string;
  closing_date: string | null;
  loan_amount: number | null;
  closed: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New', pre_qual: 'Pre-Qual', application: 'Application', processing: 'Processing',
  underwriting: 'Underwriting', conditional_approval: 'Cond. Approval', clear_to_close: 'Clear to Close',
  closed: 'Closed', declined: 'Declined', withdrawn: 'Withdrawn',
};
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export function RealtorTransactions({ token }: { token: string }) {
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    fetch(`/api/portal/realtor/${token}/transactions`)
      .then((r) => (r.ok ? r.json() : { transactions: [], totalVolume: 0 }))
      .then((j) => { setTxns(j.transactions); setVolume(j.totalVolume); })
      .catch(() => setTxns([]));
  }, [token]);

  if (txns === null) {
    return <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-6 text-center"><Loader2 size={18} className="animate-spin text-[var(--c-gold)] mx-auto" /></div>;
  }
  if (txns.length <= 1) return null; // only this loan — nothing extra to show

  return (
    <div className="bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-[var(--c-text)]">All Transactions</h2>
        <span className="text-[11px] text-[var(--c-label2)]">{usd(volume)} · {txns.length} deals</span>
      </div>
      <div className="divide-y divide-[rgba(0,0,0,0.05)]">
        {txns.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--c-text)] truncate">{t.borrower}{t.address ? ` — ${t.address}` : ''}</p>
              <p className="text-[11px] text-[var(--c-label2)]">
                {t.closed ? `Closed${t.closing_date ? ' ' + new Date(t.closing_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}` : STAGE_LABELS[t.stage] ?? t.stage}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {t.loan_amount ? <span className="text-[13px] font-mono tabular-nums text-[var(--c-text)]">{usd(Number(t.loan_amount))}</span> : null}
              <span className={`block w-2 h-2 rounded-full ml-auto mt-1 ${t.closed ? 'bg-[var(--c-success)]' : 'bg-[var(--c-gold)]'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
