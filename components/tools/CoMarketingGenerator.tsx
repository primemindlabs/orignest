'use client';

// Phase 118 — AI co-marketing generator (3-step). Generates compliant copy (Claude
// Haiku) + a co-branded HTML preview. Design/PDF export is gated (Canva/react-pdf
// unavailable at runtime); the preview is printable/shareable.
import { useState } from 'react';
import { IconCopy, IconCheck, IconArrowLeft, IconSparkles } from '@tabler/icons-react';
import { MATERIAL_TYPES, type MaterialType } from '@/lib/coMarketing/copyPrompts';

interface Realtor { id: string; first_name: string | null; last_name: string | null; brokerage_name: string | null }
const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';

export function CoMarketingGenerator({ realtors }: { realtors: Realtor[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<MaterialType | null>(null);
  const [realtorId, setRealtorId] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [openHouseDate, setOpenHouseDate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const meta = MATERIAL_TYPES.find((m) => m.id === type);

  async function generate() {
    if (!type) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/co-marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialType: type, realtorId: realtorId || null, propertyAddress, openHouseDate, customMessage }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? 'Generation failed');
      } else {
        setCopy(d.copy ?? '');
        setPreviewHtml(d.previewHtml ?? null);
        setStep(3);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  // ── Step 1: type ────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MATERIAL_TYPES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setType(m.id); setStep(2); }}
            className="text-left rounded-2xl border border-gray-100 bg-white p-4 hover:border-[#C9A95C]/40 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900">{m.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
            <p className="text-[11px] text-gray-300 mt-2">{m.size}</p>
          </button>
        ))}
      </div>
    );
  }

  // ── Step 2: configure ───────────────────────────────────────────────────────
  if (step === 2 && meta) {
    return (
      <div className="max-w-lg space-y-4">
        <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <IconArrowLeft size={14} /> Material types
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
          {meta.needsRealtor && (
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Realtor partner (optional)</span>
              <select value={realtorId} onChange={(e) => setRealtorId(e.target.value)} className={`${inputCls} bg-white mt-1`}>
                <option value="">LO-only (no co-brand)</option>
                {realtors.map((r) => (
                  <option key={r.id} value={r.id}>
                    {`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()}{r.brokerage_name ? ` — ${r.brokerage_name}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {meta.needsProperty && (
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Property address</span>
              <input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
          )}
          {type === 'open_house_flyer' && (
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Open house date</span>
              <input value={openHouseDate} onChange={(e) => setOpenHouseDate(e.target.value)} placeholder="Sat, Jun 21 · 1–4pm" className={`${inputCls} mt-1`} />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Custom note (optional)</span>
            <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={3} className={`${inputCls} mt-1 resize-none`} />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={generate} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C9A95C] py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
            <IconSparkles size={15} /> {busy ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: preview ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <IconArrowLeft size={14} /> Edit inputs
      </button>
      {previewHtml && (
        <iframe title="preview" srcDoc={previewHtml} className="w-full h-[420px] rounded-2xl border border-gray-100 bg-white" />
      )}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">Copy</p>
          <button onClick={copyText} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#C9A95C]">
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{copy}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={generate} disabled={busy} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {busy ? 'Regenerating…' : 'Regenerate copy'}
        </button>
        <button onClick={() => { setStep(1); setType(null); setCopy(null); setPreviewHtml(null); }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          New material
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Design export (Canva / branded PDF) isn’t enabled yet — the preview is print-ready and the copy is ready to paste.
      </p>
    </div>
  );
}
