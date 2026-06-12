'use client';

// Phase 85 — TCPA-gated review modal. The send button is disabled until the TCPA box is
// checked; the server independently re-validates tcpa_acknowledged + consent on file.

import { useState } from 'react';
import { IconGhost2, IconSparkles, IconSend, IconX, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

export type GhostIntervention = { id: string; suggested_message: string };

export function GhostInterventionModal({
  borrowerFirstName,
  intervention,
  aiDrafted,
  onClose,
}: {
  borrowerFirstName: string;
  intervention: GhostIntervention;
  aiDrafted: boolean;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(intervention.suggested_message);
  const [tcpa, setTcpa] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; transmitted?: boolean; text: string } | null>(null);

  const handleSend = async () => {
    if (!tcpa || sending) return; // client guard
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/ghost-interventions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervention_id: intervention.id, message, tcpa_acknowledged: tcpa }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, text: data.error || 'Send failed.' });
      } else {
        setResult({
          ok: true,
          transmitted: data.transmitted,
          text: data.transmitted ? 'Message sent.' : data.reason || 'Recorded for review (not transmitted).',
        });
      }
    } catch {
      setResult({ ok: false, text: 'Could not reach the server.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--c-surface)] rounded-[14px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--c-border)]">
          <IconGhost2 size={16} className="text-[var(--c-danger)]" />
          <span className="text-[13px] font-semibold text-[var(--c-text)]">Re-engagement message for {borrowerFirstName}</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto h-7 w-7 grid place-items-center rounded-[8px] text-[var(--c-label3)] hover:text-[var(--c-text)] hover:bg-[rgba(60,60,67,0.06)]">
            <IconX size={15} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {aiDrafted && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--c-gold-deep)] bg-[rgba(201,169,92,0.12)] rounded-full px-2.5 py-1">
              <IconSparkles size={12} /> AI-drafted — review before sending
            </div>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            disabled={!!result?.ok}
            className="w-full resize-none text-[13px] text-[var(--c-text)] bg-[rgba(60,60,67,0.05)] rounded-[10px] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
          />
          <p className="text-[10px] text-[var(--c-label3)]">{message.length} chars · no rates or commitments</p>

          <label className="flex items-start gap-2 text-[12px] text-[var(--c-text)] cursor-pointer">
            <input
              type="checkbox"
              checked={tcpa}
              onChange={(e) => setTcpa(e.target.checked)}
              disabled={!!result?.ok}
              className="mt-0.5 accent-[var(--c-gold)]"
            />
            <span>I confirm {borrowerFirstName} has opted into SMS communications and this message complies with TCPA.</span>
          </label>

          {result && (
            <div className={`flex items-center gap-1.5 text-[12px] rounded-[10px] px-3 py-2 ${result.ok ? 'text-[var(--c-green)] bg-[rgba(45,122,79,0.08)]' : 'text-[var(--c-danger)] bg-[rgba(196,114,74,0.08)]'}`}>
              {result.ok ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
              {result.text}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--c-border)]">
          <button onClick={onClose} className="h-9 px-4 rounded-[10px] text-[13px] font-medium text-[var(--c-label1)] hover:bg-[rgba(60,60,67,0.06)]">
            {result?.ok ? 'Close' : 'Cancel'}
          </button>
          {!result?.ok && (
            <button
              onClick={handleSend}
              disabled={!tcpa || sending}
              className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-[var(--c-gold)] text-white inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <IconSend size={14} /> {sending ? 'Sending…' : 'Send message'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
