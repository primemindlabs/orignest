'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Cake, Send, ExternalLink, Check } from 'lucide-react';

interface Review { id: string; review_year: number; status: string; ai_narrative: string | null; total_equity: number | null }

export function AnnualReviewManager({ recordId, initial }: { recordId: string; initial: Review[] }) {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>(initial);
  const [narrative, setNarrative] = useState<Record<string, string>>(Object.fromEntries(initial.map((r) => [r.id, r.ai_narrative ?? ''])));
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/relationships/${recordId}/annual-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) });
      if (res.ok) router.refresh();
    } finally { setBusy(false); }
  }
  async function save(id: string) {
    await fetch(`/api/relationships/${recordId}/annual-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_narrative', reviewId: id, narrative: narrative[id] }) });
  }
  async function send(id: string) {
    setBusy(true);
    try {
      await save(id);
      const res = await fetch(`/api/relationships/${recordId}/annual-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', reviewId: id }) });
      if (res.ok) { setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'sent' } : r))); router.refresh(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={generate} loading={busy} leftIcon={<Cake size={15} />}>Generate this year&apos;s review</Button>

      {reviews.length === 0 && <p className="text-[13px] text-[var(--c-label3)]">No reviews yet. Generate one from the borrower&apos;s portfolio.</p>}

      {reviews.map((r) => (
        <div key={r.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--c-text)]">{r.review_year} Anniversary Review</h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--c-fill)', color: r.status === 'sent' ? 'var(--c-success)' : 'var(--c-gold-deep)' }}>{r.status}</span>
          </div>
          <textarea
            value={narrative[r.id] ?? ''}
            onChange={(e) => setNarrative((n) => ({ ...n, [r.id]: e.target.value }))}
            rows={7}
            className="w-full rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface2)] px-3 py-2 text-[13px] leading-relaxed text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30"
          />
          <div className="flex items-center gap-2 justify-end">
            <a href={`/review/${r.id}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" leftIcon={<ExternalLink size={14} />}>Preview</Button>
            </a>
            <Button size="sm" variant="outline" onClick={() => save(r.id)}>Save</Button>
            <Button size="sm" onClick={() => send(r.id)} loading={busy} leftIcon={r.status === 'sent' ? <Check size={14} /> : <Send size={14} />}>
              {r.status === 'sent' ? 'Resend' : 'Send to borrower'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
