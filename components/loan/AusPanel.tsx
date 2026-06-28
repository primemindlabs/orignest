'use client';

/**
 * Phase 151 — per-loan AUS (DU/LPA): choose a connected provider + system (DU/LPA),
 * submit the loan's MISMO 3.4 file, and see the underwriting recommendation,
 * eligibility, risk class, DU Casefile ID / LPA AUS Key, key ratios, and findings —
 * plus the submission history.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Gavel, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Vendor { id: string; vendor: string; is_active: boolean; has_credential: boolean }
interface Finding { code?: string | null; category?: string | null; severity?: string | null; text: string }
interface Submission {
  id: string; vendor: string; aus_system: string; status: string;
  recommendation: string | null; raw_recommendation: string | null; eligibility: string | null;
  risk_class: string | null; case_file_id: string | null; dti: number | null; ltv: number | null;
  findings: Finding[] | null; report_ref: string | null; error_message: string | null; created_at: string;
}

const VENDOR_LABEL: Record<string, string> = { generic: 'Generic', fannie_du: 'Fannie Mae DU', freddie_lpa: 'Freddie Mac LPA' };
const SYSTEM_LABEL: Record<string, string> = { du: 'Desktop Underwriter', lpa: 'Loan Product Advisor' };
const REC_LABEL: Record<string, string> = {
  approve: 'Approve', accept: 'Accept', refer: 'Refer', refer_with_caution: 'Refer w/ Caution',
  caution: 'Caution', ineligible: 'Ineligible', out_of_scope: 'Out of Scope', incomplete: 'Incomplete',
  error: 'Error', unknown: 'Recommendation unclear',
};
/** Green = approve/accept · Amber = refer/caution/incomplete · Rose = ineligible/error/out_of_scope. */
function recTone(rec: string | null): 'ok' | 'warn' | 'err' {
  if (rec === 'approve' || rec === 'accept') return 'ok';
  if (rec === 'ineligible' || rec === 'error' || rec === 'out_of_scope') return 'err';
  return 'warn';
}
const fmtPct = (n: number | null) => (n == null ? null : `${n}%`);

export function AusPanel({ loanId }: { loanId: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [connId, setConnId] = useState('');
  const [system, setSystem] = useState<'du' | 'lpa'>('du');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [v, p] = await Promise.all([
      fetch('/api/settings/aus-vendors').then((r) => r.json()).catch(() => ({})),
      fetch(`/api/loans/${loanId}/aus`).then((r) => r.json()).catch(() => ({})),
    ]);
    const active = (v.connections ?? []).filter((x: Vendor) => x.is_active);
    setVendors(active); setItems(p.submissions ?? []);
    if (active[0] && !connId) setConnId(active[0].id);
    setLoading(false);
  }, [loanId, connId]);
  useEffect(() => { load(); }, [load]);

  // Native vendors are fixed to one system.
  useEffect(() => {
    const v = vendors.find((x) => x.id === connId);
    if (v?.vendor === 'fannie_du') setSystem('du');
    if (v?.vendor === 'freddie_lpa') setSystem('lpa');
  }, [connId, vendors]);
  const fixedSystem = vendors.find((x) => x.id === connId)?.vendor === 'fannie_du' || vendors.find((x) => x.id === connId)?.vendor === 'freddie_lpa';

  const run = async () => {
    if (!connId) return;
    setBusy(true); setNotice(null);
    const r = await fetch(`/api/loans/${loanId}/aus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: connId, aus_system: system }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setNotice({ tone: 'err', text: j.error ?? 'AUS submission failed.' }); return; }
    if (j.gated) setNotice({ tone: 'warn', text: `MISMO file prepared & recorded, but not transmitted — ${j.submission?.error_message ?? 'this provider has no live endpoint/credential configured.'}` });
    else if (j.submission?.status === 'error') setNotice({ tone: 'err', text: j.submission?.error_message ?? 'AUS error.' });
    else if (j.submission?.status === 'pending') setNotice({ tone: 'warn', text: 'Submitted — findings pending from the AUS.' });
    else setNotice({ tone: recTone(j.submission?.recommendation), text: `${REC_LABEL[j.submission?.recommendation] ?? 'Completed'}${j.submission?.eligibility ? ` · ${j.submission.eligibility}` : ''}${j.submission?.case_file_id ? ` · ${j.submission.case_file_id}` : ''}.` });
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  if (vendors.length === 0) return (
    <div className="border border-dashed border-[var(--c-border)] rounded-[12px] px-5 py-8 text-center">
      <p className="text-[14px] text-[var(--c-text)] font-medium">No AUS providers connected</p>
      <p className="text-[13px] text-[var(--c-label2)] mt-1">Connect DU/LPA in <Link href="/settings/integrations" className="underline">Settings → Integrations</Link> to run automated underwriting.</p>
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
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Provider"><select value={connId} onChange={(e) => setConnId(e.target.value)} className={`${inputCls} w-full`}>{vendors.map((v) => <option key={v.id} value={v.id}>{VENDOR_LABEL[v.vendor] ?? v.vendor}{v.has_credential ? '' : ' (no credential)'}</option>)}</select></Field>
          <Field label="System"><select value={system} onChange={(e) => setSystem(e.target.value as 'du' | 'lpa')} disabled={fixedSystem} className={`${inputCls} w-full disabled:opacity-60`}><option value="du">DU — Desktop Underwriter (Fannie)</option><option value="lpa">LPA — Loan Product Advisor (Freddie)</option></select></Field>
        </div>
        <button onClick={run} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />} Submit to AUS</button>
        <p className="text-[11px] text-[var(--c-label2)] mt-2">Submits the loan&apos;s MISMO 3.4 (URLA) file built from the application on file. The exact file and findings are retained for the QM/ATR &amp; GSE rep-and-warrant audit trail.</p>
      </div>

      {items.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Submission history</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {items.map((s) => (
              <div key={s.id} className="py-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--c-text)]">{VENDOR_LABEL[s.vendor] ?? s.vendor} · {SYSTEM_LABEL[s.aus_system] ?? s.aus_system.toUpperCase()}</span>
                  <span className="text-[11px] text-[var(--c-label2)]">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
                {s.status === 'completed' ? (
                  <>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${recTone(s.recommendation) === 'ok' ? 'bg-emerald-50 text-emerald-700' : recTone(s.recommendation) === 'err' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{s.raw_recommendation ?? REC_LABEL[s.recommendation ?? 'unknown'] ?? s.recommendation}</span>
                      {s.eligibility && <span className={`text-[11px] ${s.eligibility === 'eligible' ? 'text-emerald-600' : 'text-rose-600'}`}>{s.eligibility}</span>}
                      {s.risk_class && <span className="text-[11px] text-[var(--c-label2)]">· {s.risk_class}</span>}
                      {fmtPct(s.dti) && <span className="text-[11px] text-[var(--c-label2)]">· DTI {fmtPct(s.dti)}</span>}
                      {fmtPct(s.ltv) && <span className="text-[11px] text-[var(--c-label2)]">· LTV {fmtPct(s.ltv)}</span>}
                      {s.case_file_id && <span className="text-[11px] text-[var(--c-label2)]">· {s.case_file_id}</span>}
                    </div>
                    {s.findings && s.findings.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {s.findings.map((f, i) => (
                          <li key={i} className="text-[12px] text-[var(--c-label2)] flex gap-1.5">
                            <span className="text-[var(--c-label2)]">•</span>
                            <span>{f.severity && <span className="font-medium text-[var(--c-text)]">{f.severity}: </span>}{f.text}{f.code ? <span className="text-[var(--c-label2)]"> ({f.code})</span> : null}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] mt-0.5 capitalize text-amber-600">{s.status}{s.error_message ? ` — ${s.error_message}` : ''}</div>
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
