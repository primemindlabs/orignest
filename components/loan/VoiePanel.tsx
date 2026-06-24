'use client';

/**
 * Phase 150 — per-loan VOI/VOE: choose a connected vendor, run an income/employment
 * verification (instant or manual), see the verified employer/title/income, and the
 * verification history.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, BriefcaseBusiness, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Vendor { id: string; vendor: string; is_active: boolean; has_credential: boolean }
interface Verification {
  id: string; vendor: string; verification_type: string; method: string; applicant: string; status: string;
  verified: boolean; employer_name: string | null; job_title: string | null; employment_status: string | null;
  annual_income: number | null; monthly_income: number | null; pay_frequency: string | null;
  error_message: string | null; created_at: string;
}

const VENDOR_LABEL: Record<string, string> = { generic: 'Generic', truework: 'Truework', the_work_number: 'The Work Number', plaid_income: 'Plaid Income' };
const TYPE_LABEL: Record<string, string> = { income: 'Income', employment: 'Employment', both: 'Income + Employment' };

const fmtMoney = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);

export function VoiePanel({ loanId }: { loanId: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [connId, setConnId] = useState('');
  const [vtype, setVtype] = useState<'income' | 'employment' | 'both'>('both');
  const [method, setMethod] = useState<'instant' | 'manual'>('instant');
  const [applicant, setApplicant] = useState<'borrower' | 'coborrower'>('borrower');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [v, p] = await Promise.all([
      fetch('/api/settings/voie-vendors').then((r) => r.json()).catch(() => ({})),
      fetch(`/api/loans/${loanId}/voie`).then((r) => r.json()).catch(() => ({})),
    ]);
    const active = (v.connections ?? []).filter((x: Vendor) => x.is_active);
    setVendors(active); setItems(p.verifications ?? []);
    if (active[0] && !connId) setConnId(active[0].id);
    setLoading(false);
  }, [loanId, connId]);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    if (!connId) return;
    setBusy(true); setNotice(null);
    const r = await fetch(`/api/loans/${loanId}/voie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: connId, verification_type: vtype, method, applicant }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setNotice({ tone: 'err', text: j.error ?? 'Verification failed.' }); return; }
    if (j.gated) setNotice({ tone: 'warn', text: `Recorded, but not transmitted — ${j.verification?.error_message ?? 'this vendor has no live endpoint/credential configured.'}` });
    else if (j.verification?.status === 'error') setNotice({ tone: 'err', text: j.verification?.error_message ?? 'Vendor error.' });
    else if (j.verification?.status === 'pending') setNotice({ tone: 'warn', text: 'Verification ordered — results pending from the vendor.' });
    else setNotice({ tone: 'ok', text: `Verified${j.verification?.employer_name ? ` · ${j.verification.employer_name}` : ''}${j.verification?.annual_income ? ` · ${fmtMoney(j.verification.annual_income)}/yr` : ''}.` });
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  if (vendors.length === 0) return (
    <div className="border border-dashed border-[var(--c-border)] rounded-[12px] px-5 py-8 text-center">
      <p className="text-[14px] text-[var(--c-text)] font-medium">No verification vendors connected</p>
      <p className="text-[13px] text-[var(--c-label2)] mt-1">Connect one in <Link href="/settings/integrations" className="underline">Settings → Integrations</Link> to run VOI/VOE.</p>
    </div>
  );

  const card = 'border border-[var(--c-border)] rounded-[14px] p-4 bg-[var(--c-surface)]';
  const inputCls = 'h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]';

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`flex items-start gap-2 text-[13px] rounded-[12px] px-3.5 py-2.5 border ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : notice.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {notice.tone === 'ok' ? <ShieldCheck size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}<span>{notice.text}</span>
        </div>
      )}
      <div className={card}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Field label="Vendor"><select value={connId} onChange={(e) => setConnId(e.target.value)} className={`${inputCls} w-full`}>{vendors.map((v) => <option key={v.id} value={v.id}>{VENDOR_LABEL[v.vendor] ?? v.vendor}{v.has_credential ? '' : ' (no credential)'}</option>)}</select></Field>
          <Field label="Verify"><select value={vtype} onChange={(e) => setVtype(e.target.value as 'income' | 'employment' | 'both')} className={`${inputCls} w-full`}><option value="both">Income + Employment</option><option value="income">Income only</option><option value="employment">Employment only</option></select></Field>
          <Field label="Method"><select value={method} onChange={(e) => setMethod(e.target.value as 'instant' | 'manual')} className={`${inputCls} w-full`}><option value="instant">Instant</option><option value="manual">Manual</option></select></Field>
          <Field label="Applicant"><select value={applicant} onChange={(e) => setApplicant(e.target.value as 'borrower' | 'coborrower')} className={`${inputCls} w-full`}><option value="borrower">Borrower</option><option value="coborrower">Co-borrower</option></select></Field>
        </div>
        <button onClick={run} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <BriefcaseBusiness size={14} />} Run verification</button>
        <p className="text-[11px] text-[var(--c-label2)] mt-2">Requires the borrower’s authorization on file. Verified figures support the ATR/QM income documentation; the report is retained for audit.</p>
      </div>

      {items.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Verification history</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {items.map((p) => (
              <div key={p.id} className="py-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--c-text)]">{VENDOR_LABEL[p.vendor] ?? p.vendor} · {TYPE_LABEL[p.verification_type] ?? p.verification_type} · {p.method}</span>
                  <span className="text-[11px] text-[var(--c-label2)]">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                {p.status === 'completed' ? (
                  <div className="flex items-center gap-3 mt-1 text-[12px] flex-wrap">
                    <span className={`font-semibold ${p.verified ? 'text-emerald-600' : 'text-amber-600'}`}>{p.verified ? 'Verified' : 'Unverified'}</span>
                    {p.employer_name && <span className="text-[var(--c-text)]">{p.employer_name}{p.job_title ? ` · ${p.job_title}` : ''}</span>}
                    {p.employment_status && <span className="text-[var(--c-label2)]">· {p.employment_status}</span>}
                    {p.annual_income != null && <span className="text-[var(--c-label2)]">· {fmtMoney(p.annual_income)}/yr</span>}
                    {p.monthly_income != null && p.annual_income == null && <span className="text-[var(--c-label2)]">· {fmtMoney(p.monthly_income)}/mo</span>}
                  </div>
                ) : (
                  <div className="text-[11px] mt-0.5 capitalize text-amber-600">{p.status}{p.error_message ? ` — ${p.error_message}` : ''}</div>
                )}
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
