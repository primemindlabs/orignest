'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconSparkles } from '@tabler/icons-react';
import { formatPhone } from '@/lib/utils';
import type { TranscriptRow } from '@/lib/dialer/types';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function mmss(s: number | null): string {
  if (s == null) return '—';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Tab 2 — searchable archive of call transcripts with AI summaries. */
export function TranscriptionsTab() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch('/api/dialer/transcriptions');
      if (active && res.ok) {
        const j = (await res.json()) as { transcripts: TranscriptRow[] };
        setRows(j.transcripts ?? []);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (t) =>
        t.borrower_name?.toLowerCase().includes(q) ||
        t.ai_summary?.toLowerCase().includes(q) ||
        t.transcript_text?.toLowerCase().includes(q) ||
        t.to_number?.includes(q)
    );
  }, [rows, search]);

  return (
    <div className="max-w-3xl">
      <div className="relative mb-4">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3" />
        <input
          placeholder="Search transcriptions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm focus:outline-none focus:border-[#C9A95C]"
        />
      </div>

      {loading ? (
        <p className="text-center text-xs text-label-3 py-12">Loading transcriptions…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-xs text-label-3 py-12">
          {rows.length === 0 ? 'No call transcriptions yet. Summaries appear here after calls end.' : 'No matches.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TranscriptCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptCard({ t }: { t: TranscriptRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] shadow-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-label truncate">
            {t.borrower_name || (t.to_number ? formatPhone(t.to_number) : 'Unknown number')}
          </p>
          <p className="text-[11px] text-label-3">
            {fmtDate(t.created_at)} · {mmss(t.duration_seconds)}
            {t.outcome && <span className="ml-1 capitalize">· {t.outcome.replace(/_/g, ' ')}</span>}
          </p>
        </div>
      </div>

      {t.ai_summary && (
        <div
          className="mt-3 flex gap-2 text-xs text-label-2 rounded-lg px-3 py-2"
          style={{ background: 'rgba(201,169,92,0.10)' }}
        >
          <IconSparkles size={13} style={{ color: '#C9A95C' }} className="flex-shrink-0 mt-0.5" />
          <span>{t.ai_summary}</span>
        </div>
      )}

      {expanded && t.transcript_text && (
        <div className="mt-3 text-xs text-label-2 whitespace-pre-wrap leading-relaxed border-t border-black/[0.05] pt-3">
          {t.transcript_text}
        </div>
      )}

      {t.transcript_text && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-[11px] font-semibold"
          style={{ color: '#876830' }}
        >
          {expanded ? 'Collapse' : 'View full transcript ▸'}
        </button>
      )}
    </div>
  );
}
