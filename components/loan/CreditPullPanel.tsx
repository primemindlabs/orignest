'use client';

/**
 * Phase 147 — per-loan credit pull: choose a connected vendor, run a soft/hard pull,
 * see tri-bureau scores + mid score, and the pull history.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, CreditCard, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Vendor { id: string; vendor: string; is_active: boolean; has_credential: boolean }
interface Pull { id: string; vendor: string; pull_type: string; applicant: string; status: string; equifax_score: number | null; experian_score: number | null; transunion_score: number | null; mid_score: number | null; tradeline_count: number | null; error_message: string | null; created_at: string }

const VENDOR_LABEL: Record<string, string> = { generic: 'Generic', factual_data: 'Factual Data', cbc: 'CBC', meridianlink: 'MeridianLink', xactus: 'Xactus', credco: 'Credco' };

export function CreditPullPanel({ loanId }: { loanId: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pulls, setPulls] = useState<Pull[]>([]);
  const [loading, setLoading] = useState(true);
  const [connId, setConnId] = useState('');
  const [pullType, setPullType] = useState<'soft' | 'hard'>('soft');
  const [applicant, setApplicant] = useState<'borrower' | 'coborrower' | 'joint'>('borrower');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [v, p] = await Promise.all([
      fetch('/api/settings/credit-vendors').then((r) => r.json()).catch(() => ({})),
      fetch(`/api/loans/${loanId}/credit-pull`).then((r) => r.json()).catch(() => ({})),
    ]);
    const active = (v.connections ?? []).filter((x: Vendor) => x.is_active);
    setVendors(active); setPulls(p.pulls ?? []);
    if (active[0] && !connId) setConnId(active[0].id);
    setLoading(false);
  }, [loanId, connId]);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    if (!connId) return;
    setBusy(true); setNotice(null);
    const r = await fetch(`/api/loans/${loanId}/credit-pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: connId, pull_type: pullType, applicant }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setNotice({ tone: 'err', text: j.error ?? 'Pull failed.' }); return; }
    if (j.gated) setNotice({ tone: 'warn', text: `Recorded, but not transmitted — ${j.pull?.error_message ?? 'this vendor has no live endpoint/credential configured.'}` });
    else if (j.pull?.status === 'error') setNotice({ tone: 'err', text: j.pull?.error_message ?? 'Vendor error.' });
    else setNotice({ tone: 'ok', text: `Pull complete${j.pull?.mid_score ? ` · mid score ${j.pull.mid_score}` : ''}.` });
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  if (vendors.length === 0) return (
    <div className="border border-dashed border-[var(--c-border)] rounded-[12px] px-5 py-8 text-center">
      <p className="text-[14px] text-[var(--c-text)] font-medium">No credit vendors connected</p>
      <p className="text-[13px] text-[var(--c-label2)] mt-1">Connect one in <Link href="/settings/integrations" className="underline">Settings → Integrations</Link> to pull credit.</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Field label="Vendor"><select value={connId} onChange={(e) => setConnId(e.target.value)} className={`${inputCls} w-full`}>{vendors.map((v) => <option key={v.id} value={v.id}>{VENDOR_LABEL[v.vendor] ?? v.vendor}{v.has_credential ? '' : ' (no credential)'}</option>)}</select></Field>
          <Field label="Pull type"><select value={pullType} onChange={(e) => setPullType(e.target.value as 'soft' | 'hard')} className={`${inputCls} w-full`}><option value="soft">Soft</option><option value="hard">Hard</option></select></Field>
          <Field label="Applicant"><select value={applicant} onChange={(e) => setApplicant(e.target.value as 'borrower' | 'coborrower' | 'joint')} className={`${inputCls} w-full`}><option value="borrower">Borrower</option><option value="coborrower">Co-borrower</option><option value="joint">Joint</option></select></Field>
        </div>
        <button onClick={run} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Pull credit</button>
        <p className="text-[11px] text-[var(--c-label2)] mt-2">A hard pull requires the borrower’s authorization on file. Scores feed underwriting; the report is retained for FCRA audit.</p>
      </div>

      {pulls.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Pull history</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {pulls.map((p) => (
              <div key={p.id} className="py-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--c-text)] capitalize">{VENDOR_LABEL[p.vendor] ?? p.vendor} · {p.pull_type} · {p.applicant}</span>
                  <span className="text-[11px] text-[var(--c-label2)]">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                {p.status === 'completed' ? (
                  <div className="flex items-center gap-3 mt-1 text-[12px]">
                    <span className="font-semibold text-[var(--c-text)]">Mid {p.mid_score ?? '—'}</span>
                    <span className="text-[var(--c-label2)]">EQ {p.equifax_score ?? '—'} · EX {p.experian_score ?? '—'} · TU {p.transunion_score ?? '—'}</span>
                    {p.tradeline_count != null && <span className="text-[var(--c-label2)]">· {p.tradeline_count} tradelines</span>}
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
