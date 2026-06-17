'use client';

/** Phase 33.1 — compliant ad builder with a live visual preview + editable draft. */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, ShieldCheck, ShieldAlert, Copy, Check, AlertTriangle, Save, Image as ImageIcon } from 'lucide-react';
import { AdPreview } from '@/components/ads/AdPreview';
import type { AdTemplate } from '@/lib/ads/templates';

type AdType = 'purchase' | 'refinance' | 'fha' | 'va' | 'heloc' | 'coop';
type Platform = 'meta' | 'google' | 'both';

interface Variant { variant: number; headline: string; primary_text: string; cta: string; compliance_notes: string }
interface Issue { severity: 'critical' | 'high' | 'medium'; field: string; issue: string; suggestion: string }
interface Review { passed: boolean; issues: Issue[]; summary: string }
interface Draft { headline: string; primary_text: string; description: string; cta: string }

const AD_TYPES: { key: AdType; label: string; desc: string }[] = [
  { key: 'purchase', label: 'Purchase', desc: 'First-time & move-up buyers' },
  { key: 'refinance', label: 'Refinance', desc: 'Lower payment / cash-out' },
  { key: 'fha', label: 'FHA', desc: '3.5% down' },
  { key: 'va', label: 'VA', desc: 'Veterans, $0 down' },
  { key: 'heloc', label: 'HELOC', desc: 'Tap home equity' },
  { key: 'coop', label: 'Co-op', desc: 'With a realtor partner' },
];
const CTA_SUGGESTIONS = ['Learn More', 'Get Pre-Approved', 'Apply Now', 'Get a Quote', 'Get Started', 'Contact Us'];
const SEV_COLOR: Record<string, string> = { critical: 'var(--c-danger)', high: '#9a6a00', medium: 'var(--c-label2)' };

const EMPTY: Draft = { headline: '', primary_text: '', description: '', cta: 'Learn More' };

export function CreativeBuilder({
  nmls,
  companyName,
  template,
}: {
  nmls: string | null;
  companyName: string;
  template: AdTemplate | null;
}) {
  const [adType, setAdType] = useState<AdType>(template?.ad_type ?? 'purchase');
  const [platform, setPlatform] = useState<Platform>(template?.platform ?? 'meta');
  const [keyMessage, setKeyMessage] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [draft, setDraft] = useState<Draft>(
    template
      ? { headline: template.headline, primary_text: template.primary_text, description: template.description, cta: template.cta_type }
      : EMPTY,
  );
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasDraft = draft.headline.trim().length > 0;

  // Any edit to the draft invalidates a prior save + its review/export.
  function patchDraft(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    if (creativeId) { setCreativeId(null); setReview(null); setExportText(null); }
  }

  async function generate() {
    setBusy('generate'); setErr(null); setVariants([]);
    try {
      const res = await fetch('/api/ad-center/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_type: adType, platform, key_message: keyMessage }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setVariants(data.variants ?? []);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Generation failed'); } finally { setBusy(null); }
  }

  function applyVariant(v: Variant) {
    patchDraft({ headline: v.headline, primary_text: v.primary_text, cta: v.cta });
  }

  async function generateImage() {
    setBusy('image'); setErr(null);
    try {
      const res = await fetch('/api/ad-center/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_type: adType, headline: draft.headline, key_message: keyMessage }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Image generation failed');
      setImageUrl(data.url as string);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Image generation failed'); } finally { setBusy(null); }
  }

  async function save() {
    if (!hasDraft) return;
    setBusy('save'); setErr(null); setReview(null); setExportText(null);
    try {
      const res = await fetch('/api/ad-center', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_type: adType, platform, headline: draft.headline, primary_text: draft.primary_text, description: draft.description, cta_type: draft.cta, nmls_number: nmls, image_url: imageUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setCreativeId(data.creative.id);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(null); }
  }

  async function runReview() {
    if (!creativeId) return;
    setBusy('review'); setErr(null);
    try {
      const res = await fetch(`/api/ad-center/${creativeId}/compliance-review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Review failed');
      setReview(data);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Review failed'); } finally { setBusy(null); }
  }

  async function runExport() {
    if (!creativeId) return;
    setBusy('export'); setErr(null);
    try {
      const res = await fetch(`/api/ad-center/${creativeId}/export`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Export failed');
      setExportText(data.export_text);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Export failed'); } finally { setBusy(null); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-6 items-start">
      {/* ── Left: controls + editing ─────────────────────────────── */}
      <div className="space-y-5 min-w-0">
        {!nmls && (
          <div className="text-[12px] text-[var(--c-danger)] bg-[rgba(255,59,48,0.06)] rounded-[10px] px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Your profile has no NMLS#. Add it in Settings — ads can&apos;t be exported without it.
          </div>
        )}

        {/* Step 1 — type + platform + generate */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Ad type</p>
          <div className="grid grid-cols-3 gap-2">
            {AD_TYPES.map((t) => (
              <button key={t.key} onClick={() => setAdType(t.key)} className={`text-left rounded-[10px] border px-3 py-2 transition-colors ${adType === t.key ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)]' : 'border-[var(--c-border)] hover:bg-[var(--c-fill)]'}`}>
                <p className="text-[13px] font-medium text-[var(--c-text)]">{t.label}</p>
                <p className="text-[10px] text-[var(--c-label2)]">{t.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--c-label2)]">Platform:</span>
            {(['meta', 'google', 'both'] as Platform[]).map((p) => (
              <button key={p} onClick={() => setPlatform(p)} className={`text-[11px] px-2.5 py-1 rounded-full border ${platform === p ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>
                {p === 'meta' ? 'Meta' : p === 'google' ? 'Google' : 'Both'}
              </button>
            ))}
          </div>
          <Input label="Key message (optional)" value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} placeholder="fast close, first-time buyers…" />
          <Button onClick={generate} disabled={busy === 'generate'}>
            <Sparkles size={14} /> {busy === 'generate' ? 'Generating…' : 'Generate 3 Variants'}
          </Button>
        </div>

        {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}

        {/* Step 2 — variants to start from */}
        {variants.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Start from a variant</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {variants.map((v) => {
                const active = draft.headline === v.headline && draft.primary_text === v.primary_text;
                return (
                  <button key={v.variant} onClick={() => applyVariant(v)} className={`text-left bg-[var(--c-surface)] border rounded-[14px] p-3 flex flex-col transition-colors ${active ? 'border-[var(--c-gold)]' : 'border-[var(--c-border)] hover:bg-[var(--c-fill)]'}`}>
                    <p className="text-[12px] font-semibold text-[var(--c-text)] mb-1">{v.headline}</p>
                    <p className="text-[11px] text-[var(--c-label2)] flex-1 line-clamp-3">{v.primary_text}</p>
                    <p className="text-[10px] text-[var(--c-gold-deep)] mt-2">{active ? 'Editing this →' : 'Use this →'}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3 — editable draft */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Edit your ad</p>
          <Input label="Headline" value={draft.headline} onChange={(e) => patchDraft({ headline: e.target.value })} placeholder="A clear, compliant headline" />
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-label2)] mb-1">Primary text</label>
            <textarea
              value={draft.primary_text}
              onChange={(e) => patchDraft({ primary_text: e.target.value })}
              rows={4}
              placeholder="The body of your ad — no rate, APR, or payment claims."
              className="w-full rounded-[10px] border border-[var(--c-border)] bg-white text-[13px] px-3 py-2 outline-none focus:border-[var(--c-gold)] resize-y"
            />
          </div>
          <Input label="Description / link caption" value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} placeholder="Short supporting line" />
          <div>
            <Input label="Call to action" value={draft.cta} onChange={(e) => patchDraft({ cta: e.target.value })} placeholder="Learn More" />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {CTA_SUGGESTIONS.map((c) => (
                <button key={c} onClick={() => patchDraft({ cta: c })} className={`text-[11px] px-2 py-0.5 rounded-full border ${draft.cta === c ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)] hover:bg-[var(--c-fill)]'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={save} disabled={!hasDraft || busy === 'save'}>
              <Save size={14} /> {busy === 'save' ? 'Saving…' : creativeId ? 'Saved to library' : 'Save to library'}
            </Button>
            <Button variant="secondary" onClick={generateImage} disabled={!hasDraft || busy === 'image'}>
              <ImageIcon size={14} /> {busy === 'image' ? 'Generating…' : imageUrl ? 'Regenerate image' : 'Generate AI image'}
            </Button>
          </div>
        </div>

        {/* Step 4 — compliance gate */}
        {creativeId && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[var(--c-text)]">Compliance review</p>
              <Button variant="secondary" onClick={runReview} disabled={busy === 'review'}>
                <ShieldCheck size={13} /> {busy === 'review' ? 'Reviewing…' : 'Run compliance check'}
              </Button>
            </div>
            {review && (
              <div className="space-y-2">
                <p className={`text-[13px] font-semibold flex items-center gap-1.5 ${review.passed ? 'text-green' : 'text-[var(--c-danger)]'}`}>
                  {review.passed ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />} {review.passed ? 'Passed' : 'Needs changes'} — {review.summary}
                </p>
                {review.issues.map((i, idx) => (
                  <div key={idx} className="text-[12px] flex items-start gap-2">
                    <span className="text-[9px] uppercase font-bold mt-0.5" style={{ color: SEV_COLOR[i.severity] }}>{i.severity}</span>
                    <span className="text-[var(--c-text)]"><strong>{i.field}:</strong> {i.issue} <span className="text-[var(--c-label2)]">→ {i.suggestion}</span></span>
                  </div>
                ))}
                {review.passed && (
                  <Button onClick={runExport} disabled={busy === 'export'} className="mt-1">
                    {busy === 'export' ? 'Preparing…' : 'Export ad copy'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 5 — export */}
        {exportText && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Ready for {platform === 'google' ? 'Google Ads' : 'Meta Ads Manager'}</p>
              <button onClick={() => { navigator.clipboard.writeText(exportText); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="text-[12px] text-[var(--c-text)] whitespace-pre-wrap bg-[var(--c-fill)] rounded-[10px] p-3 font-sans">{exportText}</pre>
          </div>
        )}
      </div>

      {/* ── Right: live preview ──────────────────────────────────── */}
      <div className="lg:sticky lg:top-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-3">Live preview</p>
        {hasDraft ? (
          <AdPreview
            creative={{ ad_type: adType, platform, headline: draft.headline, primary_text: draft.primary_text, description: draft.description, cta_type: draft.cta, nmls_number: nmls, image_url: imageUrl }}
            companyName={companyName}
          />
        ) : (
          <div className="border border-dashed border-[var(--c-border)] rounded-[14px] py-16 px-4 text-center">
            <p className="text-[13px] text-[var(--c-label2)]">Generate variants or start typing — your ad preview appears here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
