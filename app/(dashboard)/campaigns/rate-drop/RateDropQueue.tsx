'use client';

/** Phase 30.7 — Rate Drop campaign queue. */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Send, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Draft {
  id: string;
  email_subject: string | null;
  email_body: string | null;
  sms_message: string | null;
  trigger_data: { original_rate?: number; current_rate?: number; monthly_savings?: number };
  borrower_relationships: { full_name: string | null; email: string | null } | null;
}

export function RateDropQueue({ initial }: { initial: Draft[] }) {
  const [drafts, setDrafts] = useState<Draft[]>(initial);
  const [scanning, setScanning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    setNote(null);
    try {
      const res = await fetch('/api/campaigns/rate-drop', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setNote(`Scanned ${data.eligible} eligible borrower${data.eligible === 1 ? '' : 's'} · ${data.created} new draft${data.created === 1 ? '' : 's'}`);
        const r = await fetch('/api/campaigns/rate-drop');
        const d = await r.json();
        if (r.ok) setDrafts(d.drafts ?? []);
      }
    } finally {
      setScanning(false);
    }
  }

  async function act(id: string, kind: 'send' | 'skip') {
    setBusyId(id);
    try {
      const res =
        kind === 'send'
          ? await fetch(`/api/campaigns/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'both' }) })
          : await fetch(`/api/campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip' }) });
      if (res.ok) setDrafts((ds) => ds.filter((d) => d.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--c-label2)]">
          {drafts.length} rate-drop draft{drafts.length === 1 ? '' : 's'} ready for review
          {note && <span className="text-[var(--c-gold-deep)]"> · {note}</span>}
        </p>
        <Button variant="secondary" onClick={scan} disabled={scanning}>
          <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Scanning…' : 'Scan for opportunities'}
        </Button>
      </div>

      {drafts.length === 0 && (
        <p className="text-[13px] text-[var(--c-label2)] py-8 text-center">
          No pending drafts. Run a scan — when market rates drop ≥0.25% below a past borrower&apos;s rate, Ashley IQ drafts the outreach automatically.
        </p>
      )}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
        {drafts.map((d) => {
          const t = d.trigger_data ?? {};
          const open = openId === d.id;
          return (
            <div key={d.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setOpenId(open ? null : d.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  {open ? <ChevronUp size={14} className="text-[var(--c-label2)]" /> : <ChevronDown size={14} className="text-[var(--c-label2)]" />}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--c-text)] truncate">{d.borrower_relationships?.full_name ?? 'Past borrower'}</p>
                    <p className="text-[11px] text-[var(--c-label2)] font-mono tabular-nums">
                      {t.original_rate}% → {t.current_rate}%{t.monthly_savings ? ` · $${Math.round(t.monthly_savings)}/mo savings` : ''}
                    </p>
                  </div>
                </button>
                <Button variant="ghost" onClick={() => act(d.id, 'skip')} disabled={busyId === d.id}>
                  <X size={13} /> Skip
                </Button>
                <Button onClick={() => act(d.id, 'send')} disabled={busyId === d.id}>
                  <Send size={13} /> {busyId === d.id ? '…' : 'Send'}
                </Button>
              </div>
              {open && (
                <div className="px-4 pb-3 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] mb-1">Email · {d.email_subject}</p>
                    <p className="text-[12px] text-[var(--c-text)] whitespace-pre-wrap bg-[var(--c-fill)] rounded-[10px] p-3">{d.email_body}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] mb-1">SMS</p>
                    <p className="text-[12px] text-[var(--c-text)] whitespace-pre-wrap bg-[var(--c-fill)] rounded-[10px] p-3">{d.sms_message}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
