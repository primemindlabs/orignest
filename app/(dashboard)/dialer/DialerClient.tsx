'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff, MessageSquare, Clipboard, Delete, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  stage: string;
  first_contacted_at: string | null;
  created_at: string;
}

interface CallRow {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_from: string;
  phone_to: string;
  status: string;
  duration_seconds: number;
  lead_id: string | null;
  created_at: string;
  leads: { first_name: string; last_name: string } | null;
}

type DialState = 'idle' | 'dialing' | 'connected' | 'ended';

function formatPhoneDisplay(p: string | null): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '').replace(/^1/, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}
function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function DialerClient() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);

  const [digits, setDigits] = useState('');
  const [activeLead, setActiveLead] = useState<QueueLead | null>(null);
  const [dialState, setDialState] = useState<DialState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [callSid, setCallSid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/dialer/queue');
    if (res.ok) {
      const j = (await res.json()) as { leads: QueueLead[]; twilioNumber: string | null };
      setQueue(j.leads ?? []);
      setTwilioNumber(j.twilioNumber);
    }
  }, []);

  const loadCalls = useCallback(async () => {
    const res = await fetch('/api/dialer/calls');
    if (res.ok) {
      const j = (await res.json()) as { calls: CallRow[] };
      setCalls(j.calls ?? []);
    }
  }, []);

  useEffect(() => { void loadQueue(); void loadCalls(); }, [loadQueue, loadCalls]);

  // Active-call timer
  useEffect(() => {
    if (dialState !== 'connected') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [dialState]);

  async function placeCall(phone: string, lead: QueueLead | null) {
    setError('');
    setActiveLead(lead);
    setDialState('dialing');
    setSeconds(0);
    setNotes('');
    try {
      const res = await fetch('/api/dialer/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead?.id, to_phone: phone }),
      });
      const j = (await res.json()) as { call_sid?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Failed to place call');
      setCallSid(j.call_sid ?? null);
      setDialState('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place call');
      setDialState('idle');
      setActiveLead(null);
    }
  }

  async function endCall() {
    setDialState('ended');
    if (callSid && notes.trim()) {
      await fetch('/api/dialer/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_sid: callSid, notes }),
      }).catch(() => {});
    }
    setCallSid(null);
    void loadCalls();
    setTimeout(() => { setDialState('idle'); setActiveLead(null); setSeconds(0); }, 1500);
  }

  const STATUS_LABEL: Record<DialState, string> = {
    idle: 'Idle', dialing: 'Dialing…', connected: 'Connected', ended: 'Call Ended',
  };
  const STATUS_COLOR: Record<DialState, string> = {
    idle: 'text-label-3', dialing: 'text-orange', connected: 'text-green', ended: 'text-label-2',
  };

  const padKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const callTarget = activeLead?.phone || digits;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Phone size={22} className="text-blue" />
          <h1 className="text-[24px] font-bold text-label tracking-tight">Dialer</h1>
        </div>
        {twilioNumber && <span className="text-xs text-label-2">Line: {formatPhoneDisplay(twilioNumber)}</span>}
      </div>

      {error && <div className="text-xs text-red bg-red/10 border border-red/20 rounded-xl px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[30%_35%_35%] gap-4">
        {/* Panel 1 — Queue */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <h2 className="text-sm font-semibold text-label">Call Queue</h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-black/[0.04]">
            {queue.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-label-3">No leads in the queue.</p>
            ) : queue.map((lead) => (
              <div key={lead.id} className="px-4 py-3">
                <p className="text-sm font-medium text-label">{lead.first_name} {lead.last_name}</p>
                <p className="text-xs text-label-2">{formatPhoneDisplay(lead.phone)}</p>
                <p className="text-[11px] text-label-3 mt-0.5">
                  {lead.first_contacted_at ? `Contacted ${new Date(lead.first_contacted_at).toLocaleDateString()}` : 'Never contacted'}
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue/10 text-blue">{lead.stage}</span>
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => lead.phone && placeCall(lead.phone, lead)}
                    disabled={!lead.phone || dialState === 'connected' || dialState === 'dialing'}
                    className="flex items-center gap-1 px-2.5 py-1 bg-green/10 text-green text-xs font-semibold rounded-lg hover:bg-green/20 transition-colors disabled:opacity-40"
                  >
                    <Phone size={12} /> Call
                  </button>
                  <button
                    onClick={() => router.push('/inbox')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue/10 text-blue text-xs font-semibold rounded-lg hover:bg-blue/20 transition-colors"
                  >
                    <MessageSquare size={12} /> SMS
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-black/[0.06]">
            <button onClick={() => router.push('/leads')} className="text-xs font-semibold text-blue hover:underline">View All Leads →</button>
          </div>
        </div>

        {/* Panel 2 — Dialer */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5 flex flex-col">
          {dialState === 'idle' || dialState === 'ended' ? (
            <>
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-label tracking-wide h-9">{formatPhoneDisplay(digits) || digits || ' '}</div>
                <p className={cn('text-xs font-medium mt-1', STATUS_COLOR[dialState])}>{STATUS_LABEL[dialState]}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {padKeys.map((k) => (
                  <button key={k} onClick={() => setDigits((d) => d + k)} className="aspect-square rounded-full bg-bg hover:bg-black/[0.08] text-lg font-semibold text-label transition-colors">{k}</button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={async () => { try { const t = await navigator.clipboard.readText(); setDigits(t.replace(/[^0-9*#+]/g, '')); } catch {} }}
                  className="flex items-center gap-1 text-xs text-label-2 hover:text-label px-3 py-1.5 rounded-lg hover:bg-bg transition-colors"
                >
                  <Clipboard size={13} /> Paste
                </button>
                <button onClick={() => setDigits((d) => d.slice(0, -1))} disabled={!digits} className="flex items-center gap-1 text-xs text-label-2 hover:text-label px-3 py-1.5 rounded-lg hover:bg-bg transition-colors disabled:opacity-40">
                  <Delete size={13} /> Delete
                </button>
              </div>
              <button
                onClick={() => callTarget && placeCall(callTarget, null)}
                disabled={!callTarget}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-green text-white text-sm font-semibold rounded-xl hover:bg-green/90 transition-colors disabled:opacity-40"
              >
                <Phone size={16} /> Call
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-green/15 flex items-center justify-center mb-3">
                <Phone size={26} className="text-green" />
              </div>
              <p className="text-sm font-semibold text-label">
                {activeLead ? `${activeLead.first_name} ${activeLead.last_name}` : formatPhoneDisplay(callTarget)}
              </p>
              <p className={cn('text-xs font-medium mt-0.5', STATUS_COLOR[dialState])}>{STATUS_LABEL[dialState]}</p>
              <p className="text-3xl font-bold text-label tabular-nums mt-3">{mmss(seconds)}</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add call notes…"
                rows={3}
                className="w-full mt-4 px-3 py-2 rounded-[8px] border border-border bg-bg text-sm resize-none"
              />
              <button onClick={endCall} className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red/90 transition-colors">
                <PhoneOff size={16} /> End Call
              </button>
            </div>
          )}
        </div>

        {/* Panel 3 — Recent Calls */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <h2 className="text-sm font-semibold text-label">Recent Calls</h2>
          </div>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-black/[0.04]">
            {calls.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-label-3">No calls yet.</p>
            ) : calls.map((c) => {
              const name = c.leads ? `${c.leads.first_name} ${c.leads.last_name}` : formatPhoneDisplay(c.direction === 'inbound' ? c.phone_from : c.phone_to);
              return (
                <button
                  key={c.id}
                  onClick={() => c.lead_id && router.push(`/leads/${c.lead_id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-bg transition-colors flex items-center gap-3"
                >
                  {c.direction === 'inbound' ? <ArrowDownLeft size={15} className="text-green flex-shrink-0" /> : <ArrowUpRight size={15} className="text-blue flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-label truncate">{name}</p>
                    <p className="text-[11px] text-label-3">{new Date(c.created_at).toLocaleString()} · {mmss(c.duration_seconds)}</p>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/[0.06] text-label-2 capitalize">{c.status}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
