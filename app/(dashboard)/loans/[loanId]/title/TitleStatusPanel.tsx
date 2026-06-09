'use client';

/** Phase 64.1 — LO title & closing panel: invite, documents, wire verification. */
import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, ShieldAlert, Phone } from 'lucide-react';

interface Token { id: string; token: string; url: string; title_company_name: string; title_agent_name: string | null; expires_at: string }
interface Doc { id: string; doc_type: string; doc_name: string; uploaded_by_name: string | null; uploaded_at: string }
interface Wire { id: string; account_last4: string | null; received_at: string; verified_at: string | null; change_flag: boolean; change_flag_reason: string | null }

export function TitleStatusPanel({ loanId }: { loanId: string }) {
  const [token, setToken] = useState<Token | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [inviting, setInviting] = useState(false);
  const [f, setF] = useState({ title_company_name: '', title_agent_name: '', title_agent_email: '' });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => { const r = await fetch(`/api/loans/${loanId}/title`); if (r.ok) { const d = await r.json(); setToken(d.token); setDocs(d.documents ?? []); setWires(d.wires ?? []); } }, [loanId]);
  useEffect(() => { load(); }, [load]);

  async function invite() { const r = await fetch(`/api/loans/${loanId}/title`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); if (r.ok) { setInviting(false); setF({ title_company_name: '', title_agent_name: '', title_agent_email: '' }); load(); } }
  async function verifyWire(wire_id: string) { await fetch(`/api/loans/${loanId}/title`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wire_id, verification_method: 'phone_callback' }) }); load(); }

  const inp = 'w-full mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="space-y-5">
      {token ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <p className="text-[13px] font-semibold text-[var(--c-text)]">{token.title_company_name}{token.title_agent_name ? ` · ${token.title_agent_name}` : ''}</p>
          <div className="flex items-center gap-2 mt-1"><code className="text-[11px] bg-[var(--c-fill)] rounded px-2 py-1 truncate flex-1">{token.url}</code><button onClick={() => { navigator.clipboard.writeText(token.url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-[var(--c-gold-deep)]">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>
          <p className="text-[11px] text-[var(--c-label2)] mt-1">Expires {new Date(token.expires_at).toLocaleDateString()}</p>
        </div>
      ) : inviting ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
          <input value={f.title_company_name} onChange={(e) => setF((x) => ({ ...x, title_company_name: e.target.value }))} placeholder="Title company" className={inp} />
          <input value={f.title_agent_name} onChange={(e) => setF((x) => ({ ...x, title_agent_name: e.target.value }))} placeholder="Agent name" className={inp} />
          <input value={f.title_agent_email} onChange={(e) => setF((x) => ({ ...x, title_agent_email: e.target.value }))} placeholder="Agent email" className={inp} />
          <button onClick={invite} disabled={!f.title_company_name} className="h-8 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Create portal link</button>
        </div>
      ) : (
        <button onClick={() => setInviting(true)} className="h-9 px-4 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]">Invite title company</button>
      )}

      {wires.map((w) => (
        <div key={w.id} className="rounded-[12px] border p-3.5" style={{ borderColor: w.verified_at ? 'rgba(39,174,96,0.3)' : 'rgba(196,114,74,0.4)', background: w.verified_at ? 'rgba(39,174,96,0.05)' : 'rgba(196,114,74,0.06)' }}>
          <div className="flex items-center justify-between">
            <div><p className="text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ color: w.verified_at ? '#27AE60' : 'var(--c-danger)' }}>{!w.verified_at && <ShieldAlert size={14} />} Wire instructions ••••{w.account_last4 ?? '????'}</p><p className="text-[11px] text-[var(--c-label2)]">{w.verified_at ? `Verified ${new Date(w.verified_at).toLocaleDateString()}` : 'Received — NOT verified'}{w.change_flag ? ' · ⚠ CHANGED' : ''}</p></div>
            {!w.verified_at && <button onClick={() => verifyWire(w.id)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium bg-[var(--c-gold)] text-white"><Phone size={11} /> Verified by phone</button>}
          </div>
          {w.change_flag && w.change_flag_reason && <p className="text-[11px] text-[var(--c-danger)] mt-1">{w.change_flag_reason}</p>}
        </div>
      ))}

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Documents ({docs.length})</p>
        {docs.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No title documents uploaded yet.</p> : (
          <div className="space-y-1.5">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[8px] px-3 py-2">
                <span className="text-[13px] text-[var(--c-text)]">{d.doc_name} <span className="text-[11px] text-[var(--c-label2)]">· {d.doc_type.replace(/_/g, ' ')}</span></span>
                <span className="text-[11px] text-[var(--c-label2)]">{d.uploaded_by_name} · {new Date(d.uploaded_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
