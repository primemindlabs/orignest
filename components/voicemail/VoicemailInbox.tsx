'use client';

// Phase 87 — voicemail inbox: tabbed list of call_records with a native audio player,
// transcript, "Ashley replied" badge, and lead/new-caller actions.

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  IconPlayerPlayFilled, IconPlayerPauseFilled, IconUserPlus, IconFile, IconCheck, IconPhoneIncoming,
} from '@tabler/icons-react';

export type CallRecord = {
  id: string;
  lead_id: string | null;
  caller_number: string;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  ashley_sms_sent: boolean;
  created_at: string;
  pipeline_ms: number | null;
  leads: { first_name: string | null; last_name: string | null } | null;
};

function formatPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

function AudioPlayer({ src, duration }: { src: string | null; duration: number | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  if (!src) {
    return <p className="text-[11px] text-[var(--c-label3)]">No recording available.</p>;
  }

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  };

  // Static decorative waveform.
  const bars = [6, 11, 8, 14, 9, 16, 7, 12, 5, 13, 8, 15, 6, 10, 7, 12, 9, 5, 11, 8];

  return (
    <div className="flex items-center gap-2.5 bg-[rgba(60,60,67,0.04)] rounded-[10px] px-3 py-2">
      <audio ref={ref} src={src} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} preload="none" />
      <button onClick={toggle} className="h-8 w-8 grid place-items-center rounded-full bg-[var(--c-gold)] text-white flex-shrink-0" aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <IconPlayerPauseFilled size={15} /> : <IconPlayerPlayFilled size={15} />}
      </button>
      <svg width="100%" height="22" viewBox="0 0 200 22" preserveAspectRatio="none" className="flex-1">
        {bars.map((h, i) => (
          <rect key={i} x={i * 10 + 2} y={(22 - h) / 2} width="4" height={h} rx="2" fill="var(--c-label3)" opacity={0.5} />
        ))}
      </svg>
      {duration != null && <span className="text-[11px] tabular-nums text-[var(--c-label2)] flex-shrink-0">{duration}s</span>}
    </div>
  );
}

function VoicemailCard({ call }: { call: CallRecord }) {
  const router = useRouter();
  const name = call.leads?.first_name
    ? `${call.leads.first_name} ${call.leads.last_name ?? ''}`.trim()
    : formatPhone(call.caller_number);

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-[#F5EFE0] border border-[#C9A95C] grid place-items-center flex-shrink-0">
          <IconPhoneIncoming size={16} className="text-[#8A6310]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">{name}</p>
          <p className="text-[11px] text-[var(--c-label3)]">{formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}</p>
        </div>
        {!call.lead_id && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--c-gold-deep)] bg-[rgba(201,169,92,0.12)] rounded-full px-2 py-0.5">
            <IconUserPlus size={12} /> New caller
          </span>
        )}
      </div>

      <AudioPlayer src={call.recording_url} duration={call.duration_seconds} />

      {call.transcript && <p className="text-[13px] text-[var(--c-label1)] leading-relaxed bg-[rgba(60,60,67,0.03)] rounded-[8px] p-2.5">{call.transcript}</p>}

      {call.ashley_sms_sent && (
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--c-green)]">
          <IconCheck size={14} />
          <span>Ashley replied{call.pipeline_ms != null && call.pipeline_ms <= 60_000 ? ' in <60s' : ''}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {call.lead_id ? (
          <button onClick={() => router.push(`/loans/${call.lead_id}`)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium bg-[rgba(60,60,67,0.06)] text-[var(--c-text)] hover:bg-[rgba(60,60,67,0.10)]">
            <IconFile size={14} /> View loan file
          </button>
        ) : (
          <button onClick={() => router.push(`/leads/new?phone=${encodeURIComponent(call.caller_number)}&source=voicemail&call=${call.id}`)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium bg-[var(--c-gold)] text-white">
            <IconUserPlus size={14} /> Add as lead
          </button>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New leads' },
  { key: 'known', label: 'Known borrowers' },
] as const;

export function VoicemailInbox({ calls }: { calls: CallRecord[] }) {
  const [tab, setTab] = useState<'all' | 'new' | 'known'>('all');
  const filtered = useMemo(() => {
    if (tab === 'new') return calls.filter((c) => !c.lead_id);
    if (tab === 'known') return calls.filter((c) => !!c.lead_id);
    return calls;
  }, [calls, tab]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-1 border-b border-[var(--c-border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-[#C9A95C] text-[#8A6310] font-medium' : 'border-transparent text-[var(--c-label2)] hover:text-[var(--c-text)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <IconPhoneIncoming size={32} className="text-[var(--c-label3)] mb-3" />
          <p className="text-[14px] font-medium text-[var(--c-text)]">No voicemails yet</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-1">Inbound voicemails will appear here, with Ashley&apos;s instant reply.</p>
        </div>
      ) : (
        filtered.map((c) => <VoicemailCard key={c.id} call={c} />)
      )}
    </div>
  );
}
