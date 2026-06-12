'use client';

/**
 * Phase 133 — LOA → LO draft review. Shows the caller's drafts; when the caller
 * is the reviewing LO of a pending draft, Approve / Reject act on it.
 */
import { useState, useEffect, useCallback } from 'react';
import { IconCheck, IconX, IconMessage } from '@tabler/icons-react';

interface Draft {
  id: string;
  loan_id: string | null;
  draft_type: 'sms' | 'email';
  draft_text: string;
  draft_subject: string | null;
  status: string;
  loa_id: string;
  lo_id: string;
  created_at: string;
  lead?: { first_name: string | null; last_name: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending review', approved_sent: 'Approved', rejected: 'Rejected', edited_sent: 'Edited & sent',
};

export function DraftsForReview() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/loa/drafts');
    if (res.ok) {
      const d = await res.json();
      setDrafts(d.drafts ?? []);
      setViewerId(d.viewer_id ?? null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, status: 'approved_sent' | 'rejected') {
    setBusy(id);
    try {
      const res = await fetch('/api/loa/drafts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (res.ok) setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, status } : d)));
    } finally { setBusy(null); }
  }

  if (loading) return <p className="text-[13px] text-[var(--c-label2)]">Loading drafts…</p>;
  if (drafts.length === 0) return <p className="text-[13px] text-[var(--c-label2)]">No drafts yet.</p>;

  return (
    <div className="space-y-2.5">
      {drafts.map((d) => {
        const contact = `${d.lead?.first_name ?? ''} ${d.lead?.last_name ?? ''}`.trim() || 'Contact';
        const canReview = viewerId === d.lo_id && d.status === 'pending_review';
        return (
          <div key={d.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-text)]">
                <IconMessage size={13} className="text-[var(--c-label2)]" /> {contact} · {d.draft_type.toUpperCase()}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${d.status === 'pending_review' ? 'bg-amber-50 text-amber-600' : d.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {STATUS_LABEL[d.status] ?? d.status}
              </span>
            </div>
            {d.draft_subject && <p className="text-[12px] font-medium text-[var(--c-text)]">{d.draft_subject}</p>}
            <p className="text-[13px] text-[var(--c-label2)] whitespace-pre-wrap">{d.draft_text}</p>
            {canReview && (
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => decide(d.id, 'approved_sent')} disabled={busy === d.id} className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] text-[12px] font-medium text-white bg-[#1A7A45] disabled:opacity-50">
                  <IconCheck size={13} /> Approve
                </button>
                <button onClick={() => decide(d.id, 'rejected')} disabled={busy === d.id} className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] disabled:opacity-50">
                  <IconX size={13} /> Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
