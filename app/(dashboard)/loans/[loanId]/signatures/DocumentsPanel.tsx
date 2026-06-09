'use client';

/** Phase 60.6 — Documents & Signatures: TRID gate status + envelope list + send. */
import { useState, useEffect, useCallback } from 'react';
import { Lock, ShieldCheck, Clock, CheckCircle2, XCircle, FileSignature } from 'lucide-react';

interface Gate { can_proceed: boolean; reason: string | null; code: string | null; earliest_date?: string; days_remaining?: number }
interface Env { id: string; package_type: string; status: string; sent_at: string; completed_at: string | null; expires_at: string | null }

const PKG_LABEL: Record<string, string> = { initial_disclosures: 'Initial Disclosures', closing_disclosure: 'Closing Disclosure', loe: 'Letter of Explanation', rate_lock: 'Rate Lock Confirmation', co_marketing: 'Co-Marketing Agreement', other: 'Document' };
const STATUS: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  sent: { icon: Clock, color: '#F39C12', label: 'Awaiting signature' }, partially_signed: { icon: Clock, color: '#F39C12', label: 'Partially signed' },
  completed: { icon: CheckCircle2, color: '#27AE60', label: 'Signed' }, declined: { icon: XCircle, color: 'var(--c-danger)', label: 'Declined' },
  expired: { icon: XCircle, color: 'var(--c-danger)', label: 'Expired' }, voided: { icon: XCircle, color: 'var(--c-label2)', label: 'Voided' },
};
const SENDABLE = [['initial_disclosures', 'Initial Disclosures'], ['rate_lock', 'Rate Lock Confirmation'], ['loe', 'Letter of Explanation'], ['closing_disclosure', 'Closing Disclosure']] as const;

export function DocumentsPanel({ loanId }: { loanId: string }) {
  const [gate, setGate] = useState<Gate | null>(null);
  const [envs, setEnvs] = useState<Env[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/loans/${loanId}/sign`);
    if (r.ok) { const d = await r.json(); setGate(d.trid_gate); setEnvs(d.envelopes ?? []); }
  }, [loanId]);
  useEffect(() => { load(); }, [load]);

  async function send(pkg: string) {
    setMsg(null);
    const r = await fetch(`/api/loans/${loanId}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package_type: pkg }) });
    const d = await r.json();
    if (r.ok) { await load(); setMsg('Envelope sent.'); }
    else if (d.gated) setMsg(`E-sign not yet enabled: ${d.reason} — wet-ink signing remains available.`);
    else setMsg('Could not send.');
  }

  return (
    <div className="space-y-4">
      {gate && (
        <div className="rounded-[12px] border p-4 flex items-start gap-3" style={{ borderColor: gate.can_proceed ? 'rgba(39,174,96,0.3)' : 'rgba(243,156,18,0.3)', backgroundColor: gate.can_proceed ? 'rgba(39,174,96,0.05)' : 'rgba(243,156,18,0.06)' }}>
          {gate.can_proceed ? <ShieldCheck size={18} className="text-[#27AE60] mt-0.5" /> : <Lock size={18} className="text-[#F39C12] mt-0.5" />}
          <div>
            <p className="text-[13px] font-semibold" style={{ color: gate.can_proceed ? '#27AE60' : '#B45309' }}>{gate.can_proceed ? 'TRID gate clear — fees / appraisal / lock permitted' : 'TRID gate active'}</p>
            {gate.reason && <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{gate.reason}{gate.earliest_date ? ` Earliest: ${gate.earliest_date}.` : ''}</p>}
          </div>
        </div>
      )}

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Envelopes</p>
        {envs.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No signing envelopes yet.</p> : (
          <div className="space-y-2">
            {envs.map((e) => { const s = STATUS[e.status] ?? STATUS.sent; const Icon = s.icon; return (
              <div key={e.id} className="flex items-center justify-between bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] px-3 py-2.5">
                <div><p className="text-[13px] font-medium text-[var(--c-text)]">{PKG_LABEL[e.package_type] ?? e.package_type}</p><p className="text-[11px] text-[var(--c-label2)]">Sent {new Date(e.sent_at).toLocaleDateString()}{e.expires_at ? ` · expires ${new Date(e.expires_at).toLocaleDateString()}` : ''}</p></div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: s.color }}><Icon size={13} /> {s.label}</span>
              </div>
            ); })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Send for signature</p>
        <div className="flex flex-wrap gap-2">
          {SENDABLE.map(([pkg, label]) => (
            <button key={pkg} onClick={() => send(pkg)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><FileSignature size={13} className="text-[var(--c-gold-deep)]" /> {label}</button>
          ))}
        </div>
        {msg && <p className="text-[12px] text-[var(--c-label2)] mt-2">{msg}</p>}
      </div>
    </div>
  );
}
