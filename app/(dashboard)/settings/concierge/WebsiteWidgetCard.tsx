'use client';

/**
 * Phase 146 — website chat widget config: enable, headline/greeting, and the copy-paste
 * embed snippet the LO drops on their site.
 */
import { useEffect, useState } from 'react';
import { Loader2, Globe, Copy, Check } from 'lucide-react';

interface Widget { public_key: string; enabled: boolean; headline: string; greeting: string }

export function WebsiteWidgetCard() {
  const [w, setW] = useState<Widget | null>(null);
  const [embed, setEmbed] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/concierge/widget').then((r) => r.json()).then((j) => { setW(j.widget ?? null); setEmbed(j.embed ?? ''); });
  }, []);

  const save = async () => {
    if (!w) return;
    setSaving(true); setSaved(false);
    const r = await fetch('/api/concierge/widget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: w.enabled, headline: w.headline, greeting: w.greeting }) });
    setSaving(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };
  const copy = () => { navigator.clipboard?.writeText(embed); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const input = 'w-full px-2.5 py-2 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]';

  if (!w) return <div className="border border-[var(--c-border)] rounded-[14px] p-4 flex items-center gap-2 text-[13px] text-[var(--c-label2)]"><Loader2 size={14} className="animate-spin" /> Loading widget…</div>;

  return (
    <div className="border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--c-text)] flex items-center gap-1.5"><Globe size={15} className="text-[var(--c-gold-deep)]" /> Website chat widget</h2>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">A chat bubble for your website. Ashley answers visitors and captures them as leads (owned by you).</p>
        </div>
        <button onClick={() => setW({ ...w, enabled: !w.enabled })} className={`shrink-0 w-10 h-6 rounded-full transition-colors ${w.enabled ? 'bg-[var(--c-gold-deep)]' : 'bg-[var(--c-border)]'}`}>
          <span className={`block w-4 h-4 bg-white rounded-full transition-transform mt-1 ${w.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>

      <label className="block"><span className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Headline</span><input value={w.headline} onChange={(e) => setW({ ...w, headline: e.target.value })} className={input} /></label>
      <label className="block"><span className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Greeting (first message)</span><textarea value={w.greeting} onChange={(e) => setW({ ...w, greeting: e.target.value })} rows={2} className={input} /></label>

      <div>
        <div className="text-[12px] font-medium text-[var(--c-label2)] mb-1">Embed snippet — paste before &lt;/body&gt; on your site</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[10px] px-2.5 py-2 overflow-x-auto whitespace-nowrap text-[var(--c-text)]">{embed}</code>
          <button onClick={copy} className="inline-flex items-center gap-1 h-9 px-2.5 rounded-btn text-[12px] border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] shrink-0">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Save widget</button>
        {saved && <span className="text-[13px] text-emerald-600">Saved.</span>}
        <a href={`/chat/${w.public_key}`} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--c-label2)] underline">Preview</a>
      </div>
    </div>
  );
}
