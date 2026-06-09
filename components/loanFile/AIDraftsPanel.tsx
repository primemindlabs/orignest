'use client';

/** Phase 42.3 — AI Drafts: a slide-in panel of one-click document/message drafts,
 * available from any loan file. */
import { useState } from 'react';
import { Sparkles, X, Copy, Check, ArrowLeft } from 'lucide-react';

const TYPES = [
  { key: 'loe', label: 'Letter of Explanation', icon: '📝' },
  { key: 'cover_letter', label: 'Processor Cover Letter', icon: '📨' },
  { key: 'uw_response', label: 'UW Condition Response', icon: '⚙️' },
  { key: 'rate_quote', label: 'Rate Quote Email', icon: '📊' },
  { key: 'pre_dial_brief', label: 'Pre-Call Briefing', icon: '📞' },
  { key: 'gift_letter', label: 'Gift Letter', icon: '🎁' },
  { key: 'adverse_action', label: 'Adverse Action Notice', icon: '⚠️' },
  { key: 'portal_welcome', label: 'Portal Welcome Message', icon: '👋' },
];

export function AIDraftsPanel({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ label: string; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(type: string, label: string) {
    setBusy(true); setErr(null); setDraft(null);
    try {
      const res = await fetch('/api/ai/loan-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, draft_type: type }) });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Could not generate draft.'); return; }
      setDraft({ label: d.label ?? label, text: d.draft ?? '' });
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 transition-opacity shadow-sm">
        <Sparkles size={14} /> AI Drafts
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md h-full bg-[var(--c-bg)] border-l border-[var(--c-border)] shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[var(--c-bg)] border-b border-[var(--c-border)] px-5 py-3.5 flex items-center gap-2">
              {draft && <button onClick={() => setDraft(null)} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><ArrowLeft size={16} /></button>}
              <Sparkles size={15} className="text-[var(--c-gold-deep)]" />
              <p className="text-[14px] font-semibold text-[var(--c-text)] flex-1">{draft ? draft.label : 'AI Drafts'}</p>
              <button onClick={() => setOpen(false)} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><X size={16} /></button>
            </div>

            <div className="p-5">
              {busy && <p className="text-[13px] text-[var(--c-label2)]">Generating…</p>}
              {err && <p className="text-[13px] text-[var(--c-danger)] mb-3">{err}</p>}

              {!draft && !busy && (
                <div className="grid grid-cols-1 gap-2">
                  {TYPES.map((t) => (
                    <button key={t.key} onClick={() => generate(t.key, t.label)} className="flex items-center gap-3 text-left rounded-[10px] border border-[var(--c-border)] px-3.5 py-2.5 hover:border-[var(--c-gold)] hover:bg-[var(--c-gold-light)] transition-colors">
                      <span className="text-[16px]">{t.icon}</span>
                      <span className="text-[13px] font-medium text-[var(--c-text)]">{t.label}</span>
                    </button>
                  ))}
                  <p className="text-[11px] text-[var(--c-label2)] mt-2">Drafts use [bracketed placeholders] for any specific numbers — review before sending.</p>
                </div>
              )}

              {draft && !busy && (
                <div className="space-y-3">
                  <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={18} className="w-full text-[13px] leading-relaxed rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-[var(--c-text)] resize-y focus:outline-none focus:border-[var(--c-gold)]" />
                  <button onClick={() => { navigator.clipboard.writeText(draft.text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90">{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy draft</>}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
