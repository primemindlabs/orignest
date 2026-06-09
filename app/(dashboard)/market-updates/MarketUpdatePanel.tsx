'use client';

/** Phase 30.8 — Market Update Generator UI. */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, Copy, Check } from 'lucide-react';

interface Update {
  rate_30yr_fixed: number | null;
  rate_15yr_fixed: number | null;
  rate_change_bps: number | null;
  linkedin_post: string | null;
  instagram_caption: string | null;
  sms_blast: string | null;
}

const TABS = [
  { key: 'linkedin_post', label: 'LinkedIn' },
  { key: 'instagram_caption', label: 'Instagram' },
  { key: 'sms_blast', label: 'SMS Blast' },
] as const;

export function MarketUpdatePanel({ initial }: { initial: Update | null }) {
  const [update, setUpdate] = useState<Update | null>(initial);
  const [rate30, setRate30] = useState(initial?.rate_30yr_fixed?.toString() ?? '');
  const [rate15, setRate15] = useState(initial?.rate_15yr_fixed?.toString() ?? '');
  const [bps, setBps] = useState(initial?.rate_change_bps?.toString() ?? '');
  const [context, setContext] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('linkedin_post');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/market-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate30yr: parseFloat(rate30), rate15yr: parseFloat(rate15), rateChangeBps: parseInt(bps || '0', 10), marketContext: context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setUpdate(data.update);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  const current = update ? (update[tab] ?? '') : '';

  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Input label="30-yr fixed %" value={rate30} onChange={(e) => setRate30(e.target.value)} placeholder="6.990" />
          <Input label="15-yr fixed %" value={rate15} onChange={(e) => setRate15(e.target.value)} placeholder="6.250" />
          <Input label="Change (bps)" value={bps} onChange={(e) => setBps(e.target.value)} placeholder="-12" />
        </div>
        <Input label="Context (optional)" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Fed held rates steady this week…" />
        <div className="flex items-center gap-2">
          <Button onClick={generate} disabled={busy}>
            <Sparkles size={14} /> {busy ? 'Generating…' : 'Generate Content'}
          </Button>
          {err && <span className="text-[12px] text-[var(--c-danger)]">{err}</span>}
        </div>
      </div>

      {update && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <div className="flex border-b border-[var(--c-border)]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-[var(--c-gold)] text-[var(--c-text)]' : 'border-transparent text-[var(--c-label2)]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4">
            <textarea
              value={current}
              onChange={(e) => setUpdate((u) => (u ? { ...u, [tab]: e.target.value } : u))}
              rows={tab === 'linkedin_post' ? 10 : 5}
              className="w-full text-[13px] text-[var(--c-text)] bg-[var(--c-fill)] rounded-[10px] p-3 resize-y focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(current);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
