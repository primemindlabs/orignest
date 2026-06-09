'use client';

/** Phase 52.1 — generate a shareable pre-approval certificate URL for a lead. */
import { useState } from 'react';
import { BadgeCheck, X, Copy, Check } from 'lucide-react';

const LOAN_TYPES = ['Conventional', 'FHA', 'VA', 'USDA', 'Jumbo'];

export function PreApprovalCertButton({ leadId, defaultAmount, defaultLoanType }: { leadId: string; defaultAmount?: number | null; defaultLoanType?: string | null }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ approved_amount: defaultAmount ? String(defaultAmount) : '', loan_type: defaultLoanType && LOAN_TYPES.includes(defaultLoanType) ? defaultLoanType : 'Conventional', property_type: '', expiration_date: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!form.approved_amount || !form.expiration_date) return;
    setBusy(true);
    try {
      const r = await fetch('/api/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, approved_amount: Number(form.approved_amount), loan_type: form.loan_type, property_type: form.property_type || undefined, expiration_date: form.expiration_date }) });
      const d = await r.json();
      if (r.ok) setUrl(d.url);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors">
        <BadgeCheck size={14} className="text-[var(--c-gold-deep)]" /> Pre-Approval Letter
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="bg-[var(--c-bg)] rounded-[14px] border border-[var(--c-border)] shadow-xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="text-[14px] font-semibold text-[var(--c-text)]">Pre-approval certificate</p><button onClick={() => setOpen(false)} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><X size={16} /></button></div>
            {url ? (
              <div className="space-y-2">
                <p className="text-[12px] text-[var(--c-label2)]">Shareable certificate created. Send this link to the borrower or their agent:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] bg-[var(--c-fill)] rounded px-2 py-1.5 truncate">{url}</code>
                  <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-[var(--c-gold-deep)]">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--c-gold-deep)] hover:underline">Preview certificate ↗</a>
              </div>
            ) : (
              <div className="space-y-2.5">
                <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Approved amount</span><input type="number" value={form.approved_amount} onChange={(e) => setForm((f) => ({ ...f, approved_amount: e.target.value }))} placeholder="450000" className="w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[var(--c-text)]" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Loan type</span><select value={form.loan_type} onChange={(e) => setForm((f) => ({ ...f, loan_type: e.target.value }))} className="w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-[var(--c-text)]">{LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
                  <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Expires</span><input type="date" value={form.expiration_date} onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))} className="w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-[var(--c-text)]" /></label>
                </div>
                <button onClick={generate} disabled={busy || !form.approved_amount} className="w-full h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">{busy ? 'Generating…' : 'Generate certificate'}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
