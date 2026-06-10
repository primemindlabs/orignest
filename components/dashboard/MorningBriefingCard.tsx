'use client';

/** Phase 71 (B2) — surfaces the live morning-briefing backend (/api/ai/morning-briefing,
 * Claude-generated, cached per day). Generate-on-demand so we don't fire Claude on every
 * dashboard load; same-day re-clicks return the cached briefing. */
import { useState } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

export function MorningBriefingCard() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const r = await fetch('/api/ai/morning-briefing', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      const first = Array.isArray(d.briefings) ? d.briefings[0] : null;
      setBriefing((first?.summary as string) || (first?.content as string) || 'No briefing available right now.');
    } catch { setBriefing('Could not generate a briefing right now. Try again shortly.'); }
    finally { setLoading(false); setLoaded(true); }
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-[var(--c-text)] inline-flex items-center gap-1.5"><Sparkles size={14} className="text-[var(--c-gold-deep)]" /> Today&apos;s Briefing</p>
        {loaded && (
          <button onClick={generate} disabled={loading} className="text-[var(--c-label2)] hover:text-[var(--c-text)]" title="Regenerate">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        )}
      </div>
      {briefing ? (
        <p className="text-[13px] text-[var(--c-label1)] whitespace-pre-wrap leading-relaxed">{briefing}</p>
      ) : (
        <button onClick={generate} disabled={loading} className="w-full h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : 'Generate today’s briefing'}
        </button>
      )}
    </div>
  );
}
