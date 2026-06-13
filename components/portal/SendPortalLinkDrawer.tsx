'use client';

// Extracted from the Phase 90 QuickActionsBar so the unified Ashley chat can open it.
// Texts a borrower their portal login link — requires a phone number + SMS consent (TCPA).
import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface PortalLead { id: string; first_name: string | null; last_name: string | null; phone: string | null; sms_consent: boolean; stage: string }

export function SendPortalLinkDrawer({ onClose }: { onClose: () => void }) {
  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<PortalLead | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ delivery: string; portal_url: string; error?: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/portal/send-link').then((r) => (r.ok ? r.json() : { leads: [] })).then((d) => setLeads(d.leads ?? [])).catch(() => {});
  }, []);

  const filtered = leads.filter((l) => `${l.first_name ?? ''} ${l.last_name ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const canSend = selected && selected.phone && selected.sms_consent;

  const send = useCallback(async () => {
    if (!selected) return;
    setSending(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/portal/send-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: selected.id }) });
      const data = await res.json();
      if (!res.ok && res.status === 422) { setErr(data.error); return; }
      if (!res.ok && res.status !== 502) { setErr(data.error ?? 'Failed to send'); return; }
      setResult({ delivery: data.delivery, portal_url: data.portal_url, error: data.error });
    } catch { setErr('Network error'); }
    finally { setSending(false); }
  }, [selected]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-[400px] h-full bg-[var(--c-surface)] shadow-2xl overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-[var(--c-text)]">Send portal link</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} className="text-[var(--c-label2)]" /></button>
        </div>
        <p className="text-[12px] text-[var(--c-label2)]">Text a borrower their portal login link. Requires a phone number and SMS consent (TCPA).</p>

        {!result && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search borrowers…" className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
            <div className="max-h-[42vh] overflow-y-auto space-y-1">
              {filtered.length === 0 && <p className="text-[12px] text-[var(--c-label2)] text-center py-4">No borrowers with a phone number.</p>}
              {filtered.map((l) => {
                const ok = l.phone && l.sms_consent;
                const active = selected?.id === l.id;
                return (
                  <button key={l.id} onClick={() => { setSelected(l); setErr(null); }} className={`w-full text-left px-2.5 py-2 rounded-[10px] border transition-colors ${active ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)]' : 'border-[var(--c-border)] hover:bg-[var(--c-fill)]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-[var(--c-text)] truncate">{l.first_name} {l.last_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ok ? 'bg-[#3FB68B]/15 text-[#2e8c6a]' : 'bg-[var(--c-fill)] text-[var(--c-label2)]'}`}>{ok ? 'Consent ✓' : l.phone ? 'No consent' : 'No phone'}</span>
                    </div>
                    {l.phone && <span className="text-[11px] text-[var(--c-label3)]">{l.phone}</span>}
                  </button>
                );
              })}
            </div>

            {selected && !canSend && (
              <p className="text-[12px] text-[var(--c-danger)]">{!selected.phone ? 'No phone number on file.' : 'No SMS consent on file (TCPA). Capture consent before texting.'}</p>
            )}
            {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
            <button onClick={send} disabled={!canSend || sending} className="w-full py-2.5 rounded-[10px] text-white text-[13px] font-medium disabled:opacity-40" style={{ background: 'var(--c-gold)' }}>
              {sending ? 'Sending…' : 'Send portal link'}
            </button>
          </>
        )}

        {result && (
          <div className="space-y-3 pt-2">
            <div className={`rounded-[10px] p-3 text-[13px] ${result.delivery === 'sent' ? 'bg-[#3FB68B]/10 text-[#2e8c6a]' : 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]'}`}>
              {result.delivery === 'sent' ? '✓ Portal link texted to the borrower.' : 'Recorded. Twilio isn’t configured yet (set PORTAL_LINK_LIVE + TWILIO creds to send) — copy the link below to share it manually.'}
            </div>
            <div>
              <label className="text-[11px] text-[var(--c-label2)]">Portal link</label>
              <div className="flex items-center gap-2 mt-1">
                <input readOnly value={result.portal_url} className="flex-1 text-[12px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 font-mono truncate" />
                <button onClick={() => { navigator.clipboard?.writeText(result.portal_url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} className="flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] px-2 py-2">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-[10px] border border-[var(--c-border)] text-[13px] text-[var(--c-text)]">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
