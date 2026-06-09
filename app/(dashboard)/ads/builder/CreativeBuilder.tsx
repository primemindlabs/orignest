'use client';

/** Phase 33.1 — compliant ad creative builder (generate → pick → compliance gate → export). */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, ShieldCheck, ShieldAlert, Copy, Check, AlertTriangle } from 'lucide-react';

type AdType = 'purchase' | 'refinance' | 'fha' | 'va' | 'heloc' | 'coop';
type Platform = 'meta' | 'google' | 'both';

interface Variant { variant: number; headline: string; primary_text: string; cta: string; compliance_notes: string }
interface Issue { severity: 'critical' | 'high' | 'medium'; field: string; issue: string; suggestion: string }
interface Review { passed: boolean; issues: Issue[]; summary: string }

const AD_TYPES: { key: AdType; label: string; desc: string }[] = [
  { key: 'purchase', label: 'Purchase', desc: 'First-time & move-up buyers' },
  { key: 'refinance', label: 'Refinance', desc: 'Lower payment / cash-out' },
  { key: 'fha', label: 'FHA', desc: '3.5% down' },
  { key: 'va', label: 'VA', desc: 'Veterans, $0 down' },
  { key: 'heloc', label: 'HELOC', desc: 'Tap home equity' },
  { key: 'coop', label: 'Co-op', desc: 'With a realtor partner' },
];
const SEV_COLOR: Record<string, string> = { critical: 'var(--c-danger)', high: '#9a6a00', medium: 'var(--c-label2)' };

export function CreativeBuilder({ nmls }: { nmls: string | null }) {
  const [adType, setAdType] = useState<AdType>('purchase');
  const [platform, setPlatform] = useState<Platform>('meta');
  const [keyMessage, setKeyMessage] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Variant | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy('generate'); setErr(null); setVariants([]); setChosen(null); setReview(null); setExportText(null); setCreativeId(null);
    try {
      const res = await fetch('/api/ad-center/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_type: adType, platform, key_message: keyMessage }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setVariants(data.variants ?? []);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Generation failed'); } finally { setBusy(null); }
  }

  async function pick(v: Variant) {
    setBusy('save'); setErr(null); setReview(null); setExportText(null);
    try {
      const res = await fetch('/api/ad-center', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_type: adType, platform, headline: v.headline, primary_text: v.primary_text, cta_type: v.cta, nmls_number: nmls }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setChosen(v); setCreativeId(data.creative.id);
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
    <div className="space-y-5">
      {!nmls && (
        <div className="text-[12px] text-[var(--c-danger)] bg-[rgba(255,59,48,0.06)] rounded-[10px] px-3 py-2 flex items-center gap-1.5">
          <AlertTriangle size={13} /> Your profile has no NMLS#. Add it in Settings — ads can&apos;t be exported without it.
        </div>
      )}

      {/* Step 1 — type + platform */}
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

      {/* Step 2 — variants */}
      {variants.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {variants.map((v) => (
            <div key={v.variant} className={`bg-[var(--c-surface)] border rounded-[14px] p-4 flex flex-col ${chosen?.variant === v.variant ? 'border-[var(--c-gold)]' : 'border-[var(--c-border)]'}`}>
              <p className="text-[13px] font-semibold text-[var(--c-text)] mb-1">{v.headline}</p>
              <p className="text-[12px] text-[var(--c-label2)] flex-1">{v.primary_text}</p>
              <p className="text-[11px] text-[var(--c-gold-deep)] mt-2">{v.cta}</p>
              {v.compliance_notes && <p className="text-[10px] text-[var(--c-label2)] mt-1 italic">{v.compliance_notes}</p>}
              <Button variant="secondary" onClick={() => pick(v)} disabled={busy === 'save'} className="mt-3">
                {chosen?.variant === v.variant ? 'Selected' : 'Use this'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Step 3 — compliance gate */}
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

      {/* Step 4 — export */}
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
  );
}
