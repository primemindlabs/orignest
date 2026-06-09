'use client';

/** Phase 47.6 — set up / manage credit monitoring for a borrower (matches on the
 * credit vendor's borrower ID — never SSN/DOB). */
import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, X, Circle } from 'lucide-react';

const VENDORS = [
  { v: 'creditxpert', l: 'CreditXpert' }, { v: 'factual_data', l: 'Factual Data' }, { v: 'xactus', l: 'Xactus' },
  { v: 'meridianlink', l: 'MeridianLink' }, { v: 'softpull', l: 'SoftPull' }, { v: 'scoremaster', l: 'ScoreMaster' },
  { v: 'credco', l: 'CredCo' }, { v: 'other', l: 'Other' },
];
const TYPES = [{ v: 'inquiry_alert', l: 'Inquiry alerts' }, { v: 'score_change', l: 'Score changes' }, { v: 'score_improvement', l: 'Score improvements' }, { v: 'full', l: 'Everything' }];
const ALERT_LABEL: Record<string, string> = { inquiry: '🚨 Inquiry', score_increase: '📈 Score up', score_decrease: '📉 Score down', derogatory: '⚠️ Derogatory', new_account: '🆕 New account' };

export function CreditMonitoringButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Record<string, unknown> | null>(null);
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ vendor: 'creditxpert', vendor_borrower_id: '', monitoring_type: 'full' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/credit-monitoring?lead_id=${leadId}`);
    if (res.ok) { const d = await res.json(); setEnrollment(d.enrollment); setAlerts(d.alerts ?? []); }
  }, [leadId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function enroll() {
    if (!form.vendor_borrower_id.trim()) return;
    setBusy(true);
    try { const r = await fetch('/api/credit-monitoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, ...form }) }); if (r.ok) await load(); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!enrollment?.id) return;
    setBusy(true);
    try { await fetch('/api/credit-monitoring', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: enrollment.id, cancel: true }) }); await load(); } finally { setBusy(false); }
  }

  const active = enrollment?.is_active === true;

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors">
        <ShieldAlert size={14} className={active ? 'text-green' : 'text-[var(--c-label2)]'} /> Credit monitor
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="bg-[var(--c-bg)] rounded-[14px] border border-[var(--c-border)] shadow-xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="text-[14px] font-semibold text-[var(--c-text)]">Credit monitoring</p><button onClick={() => setOpen(false)} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><X size={16} /></button></div>

            {active ? (
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3">
                <p className="text-[13px] text-[var(--c-text)] inline-flex items-center gap-1.5"><Circle size={9} className="fill-green text-green" /> Monitoring active</p>
                <p className="text-[11px] text-[var(--c-label2)] mt-0.5 capitalize">{String(enrollment?.vendor).replace('_', ' ')} · {String(enrollment?.monitoring_type).replace('_', ' ')}</p>
                <button onClick={cancel} disabled={busy} className="text-[12px] text-[var(--c-danger)] hover:underline mt-2">Cancel monitoring</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[12px] text-[var(--c-label2)]">Match on the credit vendor&apos;s borrower ID — never an SSN.</p>
                <select value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-2 text-[var(--c-text)]">{VENDORS.map((v) => <option key={v.v} value={v.v}>{v.l}</option>)}</select>
                <input value={form.vendor_borrower_id} onChange={(e) => setForm((f) => ({ ...f, vendor_borrower_id: e.target.value }))} placeholder="Vendor borrower ID" className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[var(--c-text)]" />
                <select value={form.monitoring_type} onChange={(e) => setForm((f) => ({ ...f, monitoring_type: e.target.value }))} className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-2 text-[var(--c-text)]">{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
                <button onClick={enroll} disabled={busy || !form.vendor_borrower_id.trim()} className="w-full h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 disabled:opacity-60">{busy ? 'Enrolling…' : 'Enroll'}</button>
              </div>
            )}

            {alerts.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-1.5">Alert history</p>
                <div className="space-y-1">
                  {alerts.map((a) => (
                    <div key={String(a.id)} className="flex items-center justify-between text-[12px] px-2.5 py-1.5 bg-[var(--c-surface)] rounded-[8px]">
                      <span className="text-[var(--c-text)]">{ALERT_LABEL[String(a.alert_type)] ?? String(a.alert_type)}{a.score_delta ? ` ${Number(a.score_delta) > 0 ? '+' : ''}${a.score_delta}` : ''}</span>
                      <span className="text-[var(--c-label2)]">{a.actioned_at ? '✓ actioned' : new Date(String(a.received_at)).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
