'use client';

/**
 * Stage E — Homeowners Insurance verification UI. Capture/verify the policy, see
 * coverage-adequacy vs the loan amount, and the verification history.
 */
import { useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle, Plus } from 'lucide-react';

export interface HoiRecord {
  id: string;
  carrier_name: string | null;
  policy_number: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  dwelling_coverage_amount: number | null;
  liability_coverage_amount: number | null;
  deductible_amount: number | null;
  effective_date: string | null;
  expiration_date: string | null;
  status: string;
  coverage_adequate: boolean | null;
  notes: string | null;
  verified_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', verified: 'Verified', expired: 'Expired', insufficient_coverage: 'Insufficient', waived: 'Waived',
};
const fmtMoney = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);

const blank = {
  carrier_name: '', policy_number: '', agent_name: '', agent_phone: '', agent_email: '',
  dwelling_coverage_amount: '', liability_coverage_amount: '', deductible_amount: '',
  effective_date: '', expiration_date: '', status: 'pending', notes: '',
};

export function HOIClient({ loanId, verifications, loanAmount, propertyAddress }: { loanId: string; verifications: HoiRecord[]; loanAmount: number | null; propertyAddress: string }) {
  const [items, setItems] = useState<HoiRecord[]>(verifications);
  const [form, setForm] = useState({ ...blank });
  const [showForm, setShowForm] = useState(verifications.length === 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const save = async () => {
    setBusy(true); setNotice(null);
    const r = await fetch(`/api/loans/${loanId}/hoi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setNotice({ tone: 'err', text: j.error ?? 'Could not save.' }); return; }
    setItems((prev) => [j.verification, ...prev]);
    setForm({ ...blank }); setShowForm(false);
    const adequate = j.verification?.coverage_adequate;
    setNotice(adequate === false ? { tone: 'warn', text: 'Saved — dwelling coverage is below the loan amount.' } : { tone: 'ok', text: 'HOI record saved.' });
  };

  const inputCls = 'h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)] w-full';
  const card = 'border border-[var(--c-border)] rounded-[14px] p-4 bg-[var(--c-surface)]';

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`flex items-start gap-2 text-[13px] rounded-[12px] px-3.5 py-2.5 border ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : notice.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {notice.tone === 'ok' ? <ShieldCheck size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}<span>{notice.text}</span>
        </div>
      )}

      <div className={`${card} flex items-center justify-between`}>
        <div className="text-[13px]">
          <div className="text-[var(--c-label2)]">{propertyAddress || 'Subject property'}</div>
          <div className="text-[var(--c-text)] font-medium">Loan amount: {fmtMoney(loanAmount)}</div>
        </div>
        {!showForm && <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90"><Plus size={14} /> Add policy</button>}
      </div>

      {showForm && (
        <div className={`${card} space-y-3`}>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Carrier"><input className={inputCls} value={form.carrier_name} onChange={(e) => setForm({ ...form, carrier_name: e.target.value })} /></Field>
            <Field label="Policy #"><input className={inputCls} value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} /></Field>
            <Field label="Agent name"><input className={inputCls} value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} /></Field>
            <Field label="Agent phone"><input className={inputCls} value={form.agent_phone} onChange={(e) => setForm({ ...form, agent_phone: e.target.value })} /></Field>
            <Field label="Dwelling coverage ($)"><input type="number" className={inputCls} value={form.dwelling_coverage_amount} onChange={(e) => setForm({ ...form, dwelling_coverage_amount: e.target.value })} /></Field>
            <Field label="Liability coverage ($)"><input type="number" className={inputCls} value={form.liability_coverage_amount} onChange={(e) => setForm({ ...form, liability_coverage_amount: e.target.value })} /></Field>
            <Field label="Deductible ($)"><input type="number" className={inputCls} value={form.deductible_amount} onChange={(e) => setForm({ ...form, deductible_amount: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Effective date"><input type="date" className={inputCls} value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></Field>
            <Field label="Expiration date"><input type="date" className={inputCls} value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><textarea className={`${inputCls} h-auto py-2`} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          {form.dwelling_coverage_amount && loanAmount != null && Number(form.dwelling_coverage_amount) < loanAmount && (
            <p className="flex items-center gap-1.5 text-[12px] text-amber-700"><AlertTriangle size={13} /> Dwelling coverage is below the loan amount ({fmtMoney(loanAmount)}).</p>
          )}
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
            <button onClick={() => { setShowForm(false); setNotice(null); }} className="h-9 px-3 rounded-btn text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)]">Cancel</button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Policy history</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {items.map((v) => (
              <div key={v.id} className="py-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--c-text)] font-medium">{v.carrier_name ?? 'Carrier'} {v.policy_number ? `· #${v.policy_number}` : ''}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${v.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : v.status === 'insufficient_coverage' || v.status === 'expired' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{STATUS_LABEL[v.status] ?? v.status}</span>
                    {v.coverage_adequate === false && <span className="text-[11px] text-rose-600">under-insured</span>}
                    {v.coverage_adequate === true && <span className="text-[11px] text-emerald-600">covers loan</span>}
                  </div>
                </div>
                <div className="text-[12px] text-[var(--c-label2)] mt-1 flex flex-wrap gap-x-3">
                  <span>Dwelling {fmtMoney(v.dwelling_coverage_amount)}</span>
                  {v.deductible_amount != null && <span>Deductible {fmtMoney(v.deductible_amount)}</span>}
                  {v.expiration_date && <span>Expires {new Date(v.expiration_date).toLocaleDateString()}</span>}
                  {v.agent_name && <span>Agent {v.agent_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">{label}</span>{children}</label>;
}
