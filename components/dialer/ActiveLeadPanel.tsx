'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconPhone,
  IconPhoneOff,
  IconMessage,
  IconSparkles,
  IconPlayerPlay,
  IconChevronRight,
} from '@tabler/icons-react';
import { formatPhone, formatCurrencyShort, cn } from '@/lib/utils';
import type { QueueLead, CallOutcome } from '@/lib/dialer/types';

const GOLD = '#C9A95C';
const OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'wrong_number', label: 'Wrong #' },
  { value: 'callback_scheduled', label: 'Callback' },
  { value: 'busy', label: 'Busy' },
];

type CallState = 'idle' | 'dialing' | 'connected' | 'logging';

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

interface Props {
  lead: QueueLead | null;
  onNext: () => void;
  onSkip: () => void;
  onCalled: (leadId: string, connected: boolean) => void;
}

export function ActiveLeadPanel({ lead, onNext, onSkip, onCalled }: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [tcpaWarning, setTcpaWarning] = useState<string | null>(null);
  const insightLeadRef = useRef<string | null>(null);

  // Reset per-lead state + fetch a fresh AI insight (non-blocking).
  useEffect(() => {
    if (!lead) return;
    setState('idle');
    setSeconds(0);
    setNotes('');
    setError('');
    setTcpaWarning(null);
    setCallId(null);
    setInsight(null);
    insightLeadRef.current = lead.id;
    (async () => {
      try {
        const res = await fetch('/api/dialer/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id }),
        });
        const j = (await res.json()) as { insight?: string };
        if (insightLeadRef.current === lead.id) setInsight(j.insight ?? null);
      } catch {
        /* insight is best-effort */
      }
    })();
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== 'connected') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!lead) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card flex items-center justify-center h-full min-h-[400px]">
        <p className="text-sm text-label-3">Select a lead from the queue to begin.</p>
      </div>
    );
  }

  async function handleDial() {
    if (!lead?.phone) return;
    setError('');
    setTcpaWarning(null);

    // TCPA pre-check — soft warning, manual calls are permitted.
    try {
      const tc = await fetch('/api/dialer/tcpa-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const tj = (await tc.json()) as { allowed?: boolean; reason?: string };
      if (tj && tj.allowed === false && tj.reason) setTcpaWarning(tj.reason);
    } catch {
      /* non-blocking */
    }

    setState('dialing');
    setSeconds(0);
    try {
      const res = await fetch('/api/dialer/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, to_phone: lead.phone }),
      });
      const j = (await res.json()) as { call_sid?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Failed to place call');
      setCallId(j.call_sid ?? null);
      setState('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place call');
      setState('idle');
    }
  }

  function endCall() {
    setState('logging');
  }

  async function logOutcome(outcome: CallOutcome) {
    if (!lead) return;
    // Persist a CRM activity + AI summary (best-effort; backend gates external sends).
    await fetch('/api/dialer/post-call-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, lead_id: lead.id, disposition: outcome, notes }),
    }).catch(() => {});
    onCalled(lead.id, outcome === 'connected');
    onNext();
  }

  async function handleVmDrop() {
    if (!lead) return;
    // Voicemail drop requires Twilio WebRTC config — record the outcome regardless.
    await logOutcome('voicemail');
  }

  const ringing = state === 'dialing' || state === 'connected';

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5 flex flex-col">
      {/* Identity */}
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/leads/${lead.id}`} className="text-lg font-bold text-label hover:underline">
            {lead.first_name} {lead.last_name}
          </Link>
          <p className="text-xs text-label-2 mt-0.5">
            {lead.loan_amount ? formatCurrencyShort(lead.loan_amount) : 'No amount'} · {lead.stage.replace(/_/g, ' ')}
          </p>
        </div>
        <button onClick={onSkip} className="text-xs font-medium text-label-3 hover:text-label flex items-center gap-1">
          Skip <IconChevronRight size={13} />
        </button>
      </div>

      {/* Phone + quick actions */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-sm text-label tabular-nums">{formatPhone(lead.phone)}</span>
        <Link
          href="/inbox"
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-label-2 hover:text-label px-2.5 py-1 rounded-lg bg-bg"
        >
          <IconMessage size={13} /> SMS
        </Link>
      </div>

      {/* AI insight */}
      {insight && (
        <div
          className="mt-4 flex gap-2 text-xs text-label-2 rounded-lg px-3 py-2.5"
          style={{ background: 'rgba(201,169,92,0.10)' }}
        >
          <IconSparkles size={14} style={{ color: GOLD }} className="flex-shrink-0 mt-0.5" />
          <span>{insight}</span>
        </div>
      )}

      {tcpaWarning && (
        <div className="mt-3 text-[11px] text-[#8a6310] bg-[#fdf8ee] border border-[#C9A95C]/30 rounded-lg px-3 py-2">
          {tcpaWarning}
        </div>
      )}
      {error && <div className="mt-3 text-[11px] text-red bg-red/10 rounded-lg px-3 py-2">{error}</div>}

      {/* Connected state */}
      {ringing && (
        <div className="mt-5 flex flex-col items-center">
          <div
            className={cn('w-14 h-14 rounded-full flex items-center justify-center', state === 'connected' && 'animate-pulse')}
            style={{ background: 'rgba(201,169,92,0.15)' }}
          >
            <IconPhone size={22} style={{ color: GOLD }} />
          </div>
          <p className="text-xs font-medium mt-2" style={{ color: state === 'connected' ? '#1a7a3c' : '#8a6310' }}>
            {state === 'connected' ? 'Connected' : 'Dialing…'}
          </p>
          <p className="text-2xl font-bold text-label tabular-nums mt-1">{mmss(seconds)}</p>
          <button
            onClick={endCall}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red/90 transition-colors"
          >
            <IconPhoneOff size={15} /> End call
          </button>
        </div>
      )}

      {/* Call controls */}
      {state === 'idle' && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={handleDial}
            disabled={!lead.phone}
            className="flex items-center justify-center gap-1.5 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
            style={{ background: GOLD }}
          >
            <IconPhone size={15} /> Dial
          </button>
          <button
            onClick={handleVmDrop}
            className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl bg-bg text-label-2 hover:bg-black/[0.06] transition-colors"
          >
            <IconPlayerPlay size={15} /> VM Drop
          </button>
        </div>
      )}

      {/* Outcome log */}
      {state === 'logging' && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-label mb-2">Log outcome</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Call notes…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-black/[0.08] bg-bg text-sm resize-none focus:outline-none focus:border-[#C9A95C]"
          />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => logOutcome(o.value)}
                className="text-xs font-medium py-2 rounded-lg border border-black/[0.08] text-label-2 hover:border-[#C9A95C] hover:text-label transition-colors"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
