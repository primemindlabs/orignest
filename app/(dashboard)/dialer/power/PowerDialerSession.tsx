'use client';

/**
 * Phase 33.5–33.8 — Power Dialer session: build a queue, work it with TCPA
 * enforcement, AI coaching, disposition logging, and post-call AI summaries.
 * In-browser (WebRTC) calling is gated on Twilio config; until then this logs
 * calls placed manually and runs the full compliance + AI loop.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Phone, ShieldCheck, ShieldAlert, Sparkles, SkipForward, Check } from 'lucide-react';

interface Lead { id: string; first_name: string; last_name: string; phone: string | null; property_state: string | null; stage: string; loan_type: string | null; loan_amount: number | null }
interface QueueItem { id: string; lead_id: string; position: number; status: string; lead: Lead | null }

const DISPOSITIONS = [
  { key: 'connected', label: 'Connected' },
  { key: 'voicemail', label: 'Voicemail' },
  { key: 'no_answer', label: 'No Answer' },
  { key: 'busy', label: 'Busy' },
  { key: 'wrong_number', label: 'Wrong #' },
  { key: 'not_interested', label: 'Not Interested' },
  { key: 'callback_requested', label: 'Callback' },
  { key: 'do_not_call', label: 'Do Not Call' },
];

function fmtPhone(p: string | null) {
  if (!p) return '—';
  const d = p.replace(/\D/g, '').replace(/^1/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

export function PowerDialerSession({ candidates, webrtcReady }: { candidates: Lead[]; webrtcReady: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [building, setBuilding] = useState(false);
  const [skipped, setSkipped] = useState<{ reason: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [coaching, setCoaching] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [tcpa, setTcpa] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = queue.find((q) => q.status === 'pending') ?? null;
  const remaining = queue.filter((q) => q.status === 'pending').length;

  const refresh = useCallback(async (id: string) => {
    const res = await fetch(`/api/dialer/sessions/${id}`);
    if (res.ok) { const d = await res.json(); setQueue(d.queue ?? []); }
  }, []);

  // TCPA re-check whenever the current lead changes.
  useEffect(() => {
    if (!current?.lead_id) { setTcpa(null); return; }
    setTcpa(null); setCoaching(null); setNotes('');
    fetch('/api/dialer/tcpa-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: current.lead_id }) })
      .then((r) => r.json()).then(setTcpa).catch(() => setTcpa({ allowed: false, reason: 'Check failed' }));
  }, [current?.lead_id]);

  async function build() {
    if (selected.size === 0) return;
    setBuilding(true); setErr(null); setSkipped([]);
    try {
      const res = await fetch('/api/dialer/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_ids: [...selected] }) });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Failed to start'); setSkipped((d.blocked_reasons ?? []).map((b: any) => ({ reason: b.reason }))); return; }
      setSessionId(d.session_id);
      setSkipped((d.skipped_reasons ?? []).map((b: any) => ({ reason: b.reason })));
      await refresh(d.session_id);
    } finally { setBuilding(false); }
  }

  async function getCoaching() {
    if (!notes.trim()) return;
    setCoachBusy(true);
    try {
      const res = await fetch('/api/dialer/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: notes }) });
      const d = await res.json();
      setCoaching(d.suggestion ?? 'No specific coaching for this moment — keep building rapport and confirm the next step.');
    } finally { setCoachBusy(false); }
  }

  async function disposition(kind: string) {
    if (!sessionId || !current?.lead_id) return;
    setLogging(true); setErr(null);
    try {
      await fetch(`/api/dialer/sessions/${sessionId}/log-call`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: current.lead_id, disposition: kind, phone_number_called: current.lead?.phone ?? '', tcpa_check_passed: tcpa?.allowed ?? false, tcpa_check_result: tcpa }),
      });
      // Post-call AI summary from the LO's notes.
      if (notes.trim() || kind === 'connected') {
        await fetch('/api/dialer/post-call-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: current.lead_id, disposition: kind, notes }) });
      }
      await refresh(sessionId);
    } finally { setLogging(false); }
  }

  // ── Builder ───────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="space-y-4">
        {!webrtcReady && (
          <div className="text-[12px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[10px] px-3 py-2">
            In-browser calling needs Twilio WebRTC config (API key/secret + TwiML app). Until then, place calls from your phone and log dispositions here — TCPA checks, AI coaching, and call summaries all work.
          </div>
        )}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[var(--c-text)]">Build a session · {selected.size} selected</p>
            <Button onClick={build} disabled={building || selected.size === 0}><Phone size={13} /> {building ? 'Checking TCPA…' : 'Start Session'}</Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-[var(--c-border)]">
            {candidates.length === 0 && <p className="text-[13px] text-[var(--c-label2)] p-6 text-center">No callable leads with a phone number right now.</p>}
            {candidates.map((l) => (
              <label key={l.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--c-fill)]">
                <input type="checkbox" checked={selected.has(l.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(l.id) : n.delete(l.id); return n; })} className="accent-[var(--c-gold)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--c-text)] truncate">{l.first_name} {l.last_name}</p>
                  <p className="text-[11px] text-[var(--c-label2)] font-mono">{fmtPhone(l.phone)} · {l.property_state ?? '—'}</p>
                </div>
                <span className="text-[10px] text-[var(--c-label2)] uppercase">{l.stage.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>
        {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
        {skipped.length > 0 && (
          <div className="text-[12px] text-[var(--c-label2)]"><strong>Skipped (TCPA):</strong> {skipped.map((s) => s.reason).join(' · ')}</div>
        )}
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────
  if (!current) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-center">
        <Check size={22} className="text-green mx-auto mb-2" />
        <p className="text-[14px] font-semibold text-[var(--c-text)]">Session complete</p>
        <p className="text-[12px] text-[var(--c-label2)] mt-0.5">All queued leads were worked.</p>
      </div>
    );
  }

  const lead = current.lead;
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--c-label2)]">{remaining} lead{remaining === 1 ? '' : 's'} remaining</p>

      {/* TCPA banner */}
      {tcpa && (
        <div className={`rounded-[10px] px-3 py-2.5 flex items-start gap-2 ${tcpa.allowed ? 'bg-[rgba(52,199,89,0.06)]' : 'bg-[rgba(255,59,48,0.06)]'}`}>
          {tcpa.allowed ? <ShieldCheck size={15} className="text-green flex-shrink-0 mt-0.5" /> : <ShieldAlert size={15} className="text-[var(--c-danger)] flex-shrink-0 mt-0.5" />}
          <p className="text-[12px] text-[var(--c-text)] leading-snug">{tcpa.allowed ? 'TCPA OK — within calling hours, consent on record, not DNC.' : tcpa.reason}</p>
        </div>
      )}

      {/* Current lead */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[16px] font-bold text-[var(--c-text)]">{lead?.first_name} {lead?.last_name}</p>
        <p className="text-[13px] text-[var(--c-label2)] font-mono">{fmtPhone(lead?.phone ?? null)} · {lead?.property_state ?? '—'}</p>
        <p className="text-[12px] text-[var(--c-label2)] mt-1">{lead?.loan_type?.toUpperCase() ?? ''} {lead?.loan_amount ? `· $${lead.loan_amount.toLocaleString()}` : ''} · {lead?.stage.replace(/_/g, ' ')}</p>
        <a href={`tel:${lead?.phone ?? ''}`} className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-[10px] border ${tcpa?.allowed ? 'border-[var(--c-gold)] text-[var(--c-gold-deep)] hover:bg-[var(--c-gold-light)]' : 'border-[var(--c-border)] text-[var(--c-label3)] pointer-events-none opacity-50'}`}>
          <Phone size={14} /> Call {fmtPhone(lead?.phone ?? null)}
        </a>
      </div>

      {/* Notes + coaching */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Jot what's happening on the call — objections, questions, next steps…" className="w-full text-[13px] bg-[var(--c-fill)] rounded-[10px] p-3 resize-y focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={getCoaching} disabled={coachBusy || !notes.trim()}><Sparkles size={13} /> {coachBusy ? 'Coaching…' : 'Get coaching'}</Button>
        </div>
        {coaching && <p className="text-[12px] text-[var(--c-text)] bg-[var(--c-gold-light)] rounded-[10px] px-3 py-2">💡 {coaching}</p>}
      </div>

      {/* Disposition */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Log disposition (advances queue)</p>
        <div className="grid grid-cols-4 gap-2">
          {DISPOSITIONS.map((d) => (
            <button key={d.key} onClick={() => disposition(d.key)} disabled={logging} className={`text-[12px] px-2 py-2 rounded-[10px] border transition-colors disabled:opacity-50 ${d.key === 'do_not_call' ? 'border-[rgba(255,59,48,0.3)] text-[var(--c-danger)] hover:bg-[rgba(255,59,48,0.06)]' : 'border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]'}`}>
              {d.label}
            </button>
          ))}
        </div>
        <button onClick={() => disposition('no_answer')} disabled={logging} className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><SkipForward size={13} /> Skip</button>
      </div>
      {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
    </div>
  );
}
