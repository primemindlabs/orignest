'use client';

/**
 * Phase 143 — wholesale submission + lock console for one loan.
 * Submit the loan's MISMO 3.4 file to a connected lender and request a rate lock.
 * Both degrade gracefully: with no live lender endpoint the action is recorded and
 * the UI explains it was prepared but not transmitted (no fake success).
 */
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Send, Lock, FileCode2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface Conn { id: string; lender_name: string; platform: string; submit_url: string | null; lock_url: string | null; is_active: boolean; has_credential: boolean }
interface Submission { id: string; lender_name: string; status: string; external_loan_id: string | null; external_status: string | null; error_message: string | null; submitted_at: string | null; created_at: string }
interface LockRow { id: string; lender_name: string; action: string; product_name: string | null; locked_rate: number | null; lock_number: string | null; lock_expiration: string | null; status: string; error_message: string | null; created_at: string }

const SUB_TONE: Record<string, string> = { submitted: 'text-sky-600', received: 'text-sky-600', in_review: 'text-amber-600', approved: 'text-emerald-600', suspended: 'text-amber-600', denied: 'text-rose-600', withdrawn: 'text-[var(--c-label2)]', error: 'text-rose-600', queued: 'text-[var(--c-label2)]' };
const LOCK_TONE: Record<string, string> = { confirmed: 'text-emerald-600', requested: 'text-[var(--c-label2)]', denied: 'text-rose-600', expired: 'text-amber-600', cancelled: 'text-[var(--c-label2)]', error: 'text-rose-600' };

export function LenderSubmission({ loanId }: { loanId: string }) {
  const [conns, setConns] = useState<Conn[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connId, setConnId] = useState('');
  const [busy, setBusy] = useState<'submit' | 'lock' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [lock, setLock] = useState({ action: 'lock', product_name: '', requested_rate: '', requested_price: '', lock_period_days: '30' });

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s, l] = await Promise.all([
      fetch('/api/settings/lenders').then((r) => r.json()).catch(() => ({})),
      fetch(`/api/loans/${loanId}/submit`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/loans/${loanId}/lock`).then((r) => r.json()).catch(() => ({})),
    ]);
    const active = (c.connections ?? []).filter((x: Conn) => x.is_active);
    setConns(active);
    setSubs(s.submissions ?? []);
    setLocks(l.locks ?? []);
    if (active[0] && !connId) setConnId(active[0].id);
    setLoading(false);
  }, [loanId, connId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!connId) return;
    setBusy('submit'); setNotice(null);
    const r = await fetch(`/api/loans/${loanId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: connId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setNotice({ tone: 'err', text: j.error ?? 'Submission failed.' }); return; }
    if (j.gated) setNotice({ tone: 'warn', text: `MISMO 3.4 file prepared and saved, but not transmitted — ${j.submission?.error_message ?? 'this lender has no live submission endpoint configured.'}` });
    else setNotice({ tone: 'ok', text: `Submitted to ${j.submission?.lender_name}. ${j.submission?.external_loan_id ? `Lender ref ${j.submission.external_loan_id}.` : ''}` });
    load();
  };

  const requestLock = async () => {
    if (!connId) return;
    setBusy('lock'); setNotice(null);
    const r = await fetch(`/api/loans/${loanId}/lock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: connId, ...lock }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setNotice({ tone: 'err', text: j.error ?? 'Lock request failed.' }); return; }
    if (j.gated) setNotice({ tone: 'warn', text: `Lock request recorded, but not transmitted — ${j.lock?.error_message ?? 'this lender has no live lock endpoint configured.'}` });
    else setNotice({ tone: 'ok', text: j.lock?.status === 'confirmed' ? `Lock confirmed${j.lock?.lock_number ? ` (#${j.lock.lock_number})` : ''}${j.lock?.locked_rate ? ` at ${j.lock.locked_rate}%` : ''}.` : `Lock ${j.lock?.status}.` });
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>;

  if (conns.length === 0) return (
    <div className="border border-dashed border-[var(--c-border)] rounded-[12px] px-5 py-8 text-center">
      <p className="text-[14px] text-[var(--c-text)] font-medium">No wholesale lenders connected</p>
      <p className="text-[13px] text-[var(--c-label2)] mt-1">Add a lender in <Link href="/settings/integrations" className="underline">Settings → Integrations</Link> to submit this file and request locks.</p>
    </div>
  );

  const card = 'border border-[var(--c-border)] rounded-[14px] p-4 bg-[var(--c-surface)]';
  const inputCls = 'w-full h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]';

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`flex items-start gap-2 text-[13px] rounded-[12px] px-3.5 py-2.5 border ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : notice.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {notice.tone === 'ok' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className={card}>
        <label className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Lender</label>
        <select value={connId} onChange={(e) => setConnId(e.target.value)} className={inputCls}>
          {conns.map((c) => <option key={c.id} value={c.id}>{c.lender_name}{c.has_credential ? '' : ' (no credential)'}</option>)}
        </select>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={submit} disabled={busy !== null} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">
            {busy === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit MISMO 3.4
          </button>
          <a href={`/api/loans/${loanId}/mismo`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><FileCode2 size={14} /> Preview file</a>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-[13px] font-semibold text-[var(--c-text)] flex items-center gap-1.5 mb-3"><Lock size={14} className="text-[var(--c-gold-deep)]" /> Rate lock</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Field label="Action"><select value={lock.action} onChange={(e) => setLock({ ...lock, action: e.target.value })} className={inputCls}>{['lock', 'extend', 'relock', 'float_down', 'cancel'].map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}</select></Field>
          <Field label="Product"><input value={lock.product_name} onChange={(e) => setLock({ ...lock, product_name: e.target.value })} placeholder="30yr Fixed" className={inputCls} /></Field>
          <Field label="Lock days"><input value={lock.lock_period_days} onChange={(e) => setLock({ ...lock, lock_period_days: e.target.value })} inputMode="numeric" className={inputCls} /></Field>
          <Field label="Rate %"><input value={lock.requested_rate} onChange={(e) => setLock({ ...lock, requested_rate: e.target.value })} inputMode="decimal" placeholder="6.875" className={inputCls} /></Field>
          <Field label="Price"><input value={lock.requested_price} onChange={(e) => setLock({ ...lock, requested_price: e.target.value })} inputMode="decimal" placeholder="100.25" className={inputCls} /></Field>
        </div>
        <button onClick={requestLock} disabled={busy !== null} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] disabled:opacity-50">
          {busy === 'lock' ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Request lock
        </button>
      </div>

      {subs.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Submission history</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {subs.map((s) => (
              <div key={s.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <span className="text-[var(--c-text)]">{s.lender_name ?? 'Lender'}</span>
                  {s.external_loan_id && <span className="text-[var(--c-label2)]"> · ref {s.external_loan_id}</span>}
                  {s.error_message && <div className="text-[11px] text-rose-600 truncate">{s.error_message}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-medium capitalize ${SUB_TONE[s.status] ?? 'text-[var(--c-label2)]'}`}>{s.status.replace('_', ' ')}</span>
                  <span className="text-[11px] text-[var(--c-label2)] inline-flex items-center gap-1"><Clock size={11} />{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {locks.length > 0 && (
        <div className={card}>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Lock history</h3>
          <div className="divide-y divide-[var(--c-border)]">
            {locks.map((l) => (
              <div key={l.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <span className="text-[var(--c-text)] capitalize">{l.action.replace('_', ' ')}</span>
                  {l.product_name && <span className="text-[var(--c-label2)]"> · {l.product_name}</span>}
                  {l.locked_rate != null && <span className="text-[var(--c-label2)]"> · {l.locked_rate}%</span>}
                  {l.lock_number && <span className="text-[var(--c-label2)]"> · #{l.lock_number}</span>}
                  {l.lock_expiration && <span className="text-[var(--c-label2)]"> · exp {new Date(l.lock_expiration).toLocaleDateString()}</span>}
                  {l.error_message && <div className="text-[11px] text-rose-600 truncate">{l.error_message}</div>}
                </div>
                <span className={`font-medium capitalize shrink-0 ${LOCK_TONE[l.status] ?? 'text-[var(--c-label2)]'}`}>{l.status}</span>
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
