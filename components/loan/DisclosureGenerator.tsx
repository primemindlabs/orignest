'use client';

/**
 * Phase 148 — generate + issue a borrower Loan Estimate from a fee worksheet.
 * Preview computes figures without saving; Issue persists the package, logs the
 * le_issued TRID event, and returns a borrower delivery link.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileCheck, Send, Copy, Check, Clock, CheckCircle2 } from 'lucide-react';

const FEE_FIELDS: { key: string; label: string }[] = [
  { key: 'origination_charges', label: 'Origination charges (A)' },
  { key: 'services_cannot_shop', label: 'Services you cannot shop for (B)' },
  { key: 'services_can_shop', label: 'Services you can shop for (C)' },
  { key: 'taxes_government_fees', label: 'Taxes & government fees (E)' },
  { key: 'prepaids', label: 'Prepaids (F)' },
  { key: 'initial_escrow', label: 'Initial escrow (G)' },
  { key: 'other', label: 'Other (H)' },
  { key: 'lender_credits', label: 'Lender credits (−)' },
];

const money = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface Pkg { id: string; status: string; delivery_token: string | null; issued_at: string | null; acknowledged_at: string | null; created_at: string }

export function DisclosureGenerator({ loanId }: { loanId: string }) {
  const [fees, setFees] = useState<Record<string, string>>({});
  const [le, setLe] = useState<any>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [busy, setBusy] = useState<'preview' | 'issue' | null>(null);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch(`/api/loans/${loanId}/disclosures/generate`).then((r) => r.json()).catch(() => ({}));
    setPkgs(j.packages ?? []);
  }, [loanId]);
  useEffect(() => { load(); }, [load]);

  const feesNum = () => Object.fromEntries(Object.entries(fees).map(([k, v]) => [k, Number(v) || 0]));

  const preview = async () => {
    setBusy('preview'); setErr(null);
    const j = await fetch(`/api/loans/${loanId}/disclosures/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', fees: feesNum() }) }).then((r) => r.json());
    setBusy(null);
    if (j.error) { setErr(j.error); return; }
    setLe(j.le);
  };
  const issue = async () => {
    setBusy('issue'); setErr(null);
    const r = await fetch(`/api/loans/${loanId}/disclosures/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'issue', fees: feesNum() }) });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) { setErr(j.error ?? 'Could not issue.'); return; }
    const token = j.package?.delivery_token;
    if (token) setIssuedLink(`${window.location.origin}/disclosure/${token}`);
    load();
  };
  const copy = () => { if (issuedLink) { navigator.clipboard?.writeText(issuedLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } };

  const card = 'border border-[var(--c-border)] rounded-[14px] p-4 bg-[var(--c-surface)]';
  const inputCls = 'w-full h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]';

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-3">Fee worksheet</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {FEE_FIELDS.map((f) => (
            <label key={f.key} className="block"><span className="text-[12px] text-[var(--c-label2)] mb-1 block">{f.label}</span>
              <input inputMode="decimal" value={fees[f.key] ?? ''} onChange={(e) => setFees({ ...fees, [f.key]: e.target.value })} placeholder="0" className={inputCls} /></label>
          ))}
        </div>
        {err && <div className="text-[12px] text-rose-600 mt-2">{err}</div>}
        <div className="flex items-center gap-2 mt-3">
          <button onClick={preview} disabled={busy !== null} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] disabled:opacity-50">{busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />} Preview</button>
          <button onClick={issue} disabled={busy !== null || !le} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy === 'issue' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Issue to borrower</button>
        </div>
        <p className="text-[11px] text-[var(--c-label2)] mt-2">Preview the estimate first, then issue. Issuing logs the TRID “Loan Estimate issued” event and creates a borrower link.</p>
      </div>

      {le && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Estimate preview</h3>
          <div className="text-[13px] grid grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-[var(--c-label2)]">Loan amount</span><span className="text-right">{money(le.loan.amount)}</span>
            <span className="text-[var(--c-label2)]">Rate / product</span><span className="text-right">{le.loan.rate ? `${le.loan.rate}%` : '—'} · {le.loan.product}</span>
            <span className="text-[var(--c-label2)]">Monthly P&amp;I</span><span className="text-right font-semibold">{money(le.loan.monthlyPI)}</span>
            <span className="text-[var(--c-label2)]">Total closing costs</span><span className="text-right font-semibold">{money(le.closingCosts.total_closing_costs)}</span>
            <span className="text-[var(--c-label2)]">Estimated cash to close</span><span className="text-right font-semibold">{money(le.cashToClose)}</span>
          </div>
        </div>
      )}

      {issuedLink && (
        <div className={`${card} border-emerald-300`}>
          <div className="text-[13px] font-medium text-emerald-700 flex items-center gap-1.5 mb-2"><CheckCircle2 size={15} /> Issued — share this link with the borrower</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[10px] px-2.5 py-2 overflow-x-auto whitespace-nowrap">{issuedLink}</code>
            <button onClick={copy} className="inline-flex items-center gap-1 h-9 px-2.5 rounded-btn text-[12px] border border-[var(--c-border)] hover:bg-[var(--c-fill)] shrink-0">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}

      {pkgs.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Issued disclosures</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {pkgs.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                <span className="capitalize text-[var(--c-text)]">Loan Estimate · {p.status}</span>
                <span className="text-[11px] text-[var(--c-label2)] inline-flex items-center gap-1">
                  {p.acknowledged_at ? <><CheckCircle2 size={11} className="text-emerald-600" /> acknowledged</> : <><Clock size={11} /> {new Date(p.created_at).toLocaleDateString()}</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
