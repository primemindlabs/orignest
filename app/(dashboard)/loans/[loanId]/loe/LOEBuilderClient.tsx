'use client';

/** Phase 62.1 — LOE Builder: pick a condition, generate an AI draft, edit, advance. */
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, FileText, Send } from 'lucide-react';

interface Loe { id: string; category: string; status: string; ai_draft_text: string | null; final_text: string | null; created_at: string }

const CATEGORIES = ['large_deposit', 'gift_funds', 'credit_inquiry', 'employment_gap', 'change_of_employment', 'bankruptcy', 'foreclosure', 'late_payments', 'collections', 'address_discrepancy', 'name_discrepancy', 'down_payment_source', 'rental_income', 'other'];
const FIELDS: Record<string, { key: string; label: string }[]> = {
  large_deposit: [{ key: 'amount', label: 'Amount' }, { key: 'date', label: 'Deposit date' }, { key: 'account_type', label: 'Account' }, { key: 'source', label: 'Source of funds' }],
  gift_funds: [{ key: 'amount', label: 'Gift amount' }, { key: 'donor_relationship', label: 'Donor relationship' }],
  employment_gap: [{ key: 'gap_start', label: 'Gap start' }, { key: 'gap_end', label: 'Gap end' }, { key: 'reason', label: 'Reason' }, { key: 'new_employer_name', label: 'Current employer' }],
  bankruptcy: [{ key: 'chapter', label: 'Chapter' }, { key: 'discharge_date', label: 'Discharge date' }, { key: 'reason', label: 'Circumstances' }, { key: 'recovery_steps', label: 'Steps since' }],
  credit_inquiry: [{ key: 'inquiry_creditor', label: 'Creditor' }, { key: 'inquiry_date', label: 'Date' }, { key: 'reason', label: 'Reason' }],
};
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', lo_review: 'In review', sent_for_signature: 'Out for signature', signed: 'Signed', submitted_to_uw: 'Submitted to UW', accepted: 'Accepted' };

export function LOEBuilderClient({ loanId }: { loanId: string }) {
  const [loes, setLoes] = useState<Loe[]>([]);
  const [cat, setCat] = useState('large_deposit');
  const [ctx, setCtx] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Loe | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => { const r = await fetch(`/api/loes?loan_id=${loanId}`); if (r.ok) setLoes((await r.json()).loes ?? []); }, [loanId]);
  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/loes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loan_id: loanId, category: cat, trigger_details: ctx }) });
      const d = await r.json();
      if (r.ok) { setActive(d.loe); setText(d.loe.final_text ?? d.loe.ai_draft_text ?? ''); setCtx({}); await load(); }
      else setMsg(d.error ?? 'Could not generate');
    } finally { setBusy(false); }
  }
  async function save(status?: string) {
    if (!active) return;
    const r = await fetch('/api/loes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: active.id, final_text: text, status }) });
    const d = await r.json();
    if (r.ok) { setMsg('Saved.'); await load(); }
    else if (d.gated) setMsg(d.reason);
    else setMsg('Could not save.');
  }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';
  const fields = FIELDS[cat] ?? [{ key: 'reason', label: 'Explanation / context' }];

  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
        <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Condition</span><select value={cat} onChange={(e) => { setCat(e.target.value); setCtx({}); }} className={inp}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <label key={f.key} className="block"><span className="text-[11px] text-[var(--c-label2)]">{f.label}</span><input value={ctx[f.key] ?? ''} onChange={(e) => setCtx((x) => ({ ...x, [f.key]: e.target.value }))} className={inp} /></label>
          ))}
        </div>
        <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60"><Sparkles size={14} /> {busy ? 'Drafting…' : 'Generate AI draft'}</button>
      </div>

      {active && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
          <p className="text-[12px] font-semibold text-[var(--c-text)]">Draft — {active.category.replace(/_/g, ' ')}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)] leading-relaxed font-sans" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => save('lo_review')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white">Save draft</button>
            <button onClick={() => save('sent_for_signature')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><Send size={12} /> Send for e-signature</button>
            <button onClick={() => save('submitted_to_uw')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]">Mark submitted to UW</button>
          </div>
          {msg && <p className="text-[12px] text-[var(--c-label2)]">{msg}</p>}
        </div>
      )}

      {loes.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Letters on this loan</p>
          <div className="space-y-2">
            {loes.map((l) => (
              <button key={l.id} onClick={() => { setActive(l); setText(l.final_text ?? l.ai_draft_text ?? ''); }} className="w-full flex items-center justify-between bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] px-3 py-2.5 text-left hover:border-[var(--c-gold)]/50">
                <span className="inline-flex items-center gap-2 text-[13px] text-[var(--c-text)]"><FileText size={14} className="text-[var(--c-gold-deep)]" /> {l.category.replace(/_/g, ' ')}</span>
                <span className="text-[11px] font-semibold text-[var(--c-label2)]">{STATUS_LABEL[l.status] ?? l.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
