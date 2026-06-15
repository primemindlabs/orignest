'use client';

// Canva-like design studio: template gallery (left) → live editable canvas (center)
// → properties + export (right). Shared by Co-Marketing and Social. The canvas
// renders at true design pixels inside a scaled wrapper so exports are crisp.
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Download, Sparkles, Image as ImageIcon } from 'lucide-react';
import {
  templatesForSurface, ASPECT_DIM, type StudioTemplate, type StudioStyle,
} from '@/lib/design/studioTemplates';

export interface StudioLO { name: string; nmls: string | null; phone: string | null; }
export interface StudioPartner { id: string; name: string; company: string | null; }

type Values = Record<string, string>;

const ACCENTS = ['#2563eb', '#0f766e', '#C9A95C', '#7c3aed', '#db2777', '#ea580c', '#0f1d2e'];

// ── Canvas renderer ───────────────────────────────────────────────────────────
function styleTokens(style: StudioStyle, accent: string) {
  switch (style) {
    case 'bold-gradient':
      return { bg: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -30)} 100%)`, fg: '#ffffff', sub: 'rgba(255,255,255,0.85)', chip: 'rgba(255,255,255,0.18)', chipFg: '#fff' };
    case 'dark-luxe':
      return { bg: 'linear-gradient(160deg, #0f1d2e 0%, #1a2a3f 100%)', fg: '#ffffff', sub: 'rgba(255,255,255,0.78)', chip: accent, chipFg: '#0f1d2e' };
    case 'editorial':
      return { bg: '#faf8f3', fg: '#1a1a1a', sub: '#555', chip: accent, chipFg: '#fff' };
    case 'clean-light':
    default:
      return { bg: '#ffffff', fg: '#111827', sub: '#4b5563', chip: `${accent}1a`, chipFg: accent };
  }
}

// Lighten/darken a hex color.
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 0xff) + amt), b = clamp((n & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function Canvas({
  template, values, accent, lo, partner, showCoBrand,
}: {
  template: StudioTemplate; values: Values; accent: string;
  lo: StudioLO; partner: StudioPartner | null; showCoBrand: boolean;
}) {
  const dim = ASPECT_DIM[template.aspect];
  const t = styleTokens(template.style, accent);
  const v = (k: string) => values[k] ?? '';
  const headlineSize = dim.w >= 1200 ? 64 : template.aspect === 'story' ? 84 : 76;

  return (
    <div
      id="studio-canvas"
      style={{
        width: dim.w, height: dim.h, background: t.bg, color: t.fg,
        padding: 80, display: 'flex', flexDirection: 'column', position: 'relative',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      {/* accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 18, height: '100%', background: accent }} />

      {v('eyebrow') && (
        <span style={{ alignSelf: 'flex-start', background: t.chip, color: t.chipFg, fontWeight: 700, fontSize: 28, letterSpacing: 2, padding: '12px 24px', borderRadius: 999 }}>
          {v('eyebrow')}
        </span>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <h1 style={{ fontSize: headlineSize, lineHeight: 1.05, fontWeight: 800, margin: 0, letterSpacing: -1 }}>{v('headline')}</h1>
        {v('subheadline') && <p style={{ fontSize: 38, fontWeight: 600, margin: 0, color: t.sub }}>{v('subheadline')}</p>}
        {v('body') && <p style={{ fontSize: 30, lineHeight: 1.4, margin: 0, color: t.sub, maxWidth: '88%' }}>{v('body')}</p>}
        {v('cta') && (
          <span style={{ alignSelf: 'flex-start', marginTop: 8, background: accent, color: '#fff', fontWeight: 700, fontSize: 30, padding: '18px 34px', borderRadius: 16 }}>
            {v('cta')}
          </span>
        )}
      </div>

      {/* footer / co-brand */}
      <div style={{ borderTop: `2px solid ${template.style === 'editorial' ? '#e5e0d5' : 'rgba(127,127,127,0.25)'}`, paddingTop: 28, display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 30 }}>{lo.name || 'Your Name'}</p>
          <p style={{ margin: 0, fontSize: 24, color: t.sub }}>
            {lo.nmls ? `NMLS #${lo.nmls}` : 'Loan Officer'}{lo.phone ? ` · ${lo.phone}` : ''}
          </p>
        </div>
        {showCoBrand && partner && (
          <>
            <div style={{ width: 2, height: 56, background: 'rgba(127,127,127,0.3)' }} />
            <div style={{ flex: 1, textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 30 }}>{partner.name}</p>
              <p style={{ margin: 0, fontSize: 24, color: t.sub }}>{partner.company ?? 'Real Estate Partner'}</p>
            </div>
          </>
        )}
      </div>

      <p style={{ position: 'absolute', bottom: 26, left: 80, right: 80, margin: 0, fontSize: 17, color: t.sub, opacity: 0.8 }}>
        Equal Housing Lender. Not a commitment to lend. Subject to credit approval.
      </p>
    </div>
  );
}

// ── Studio shell ──────────────────────────────────────────────────────────────
export function DesignStudio({
  surface, lo, partners,
}: {
  surface: StudioTemplate['surface']; lo: StudioLO; partners: StudioPartner[];
}) {
  const templates = useMemo(() => templatesForSurface(surface), [surface]);
  const [tpl, setTpl] = useState<StudioTemplate>(templates[0]);
  const [values, setValues] = useState<Values>(() => Object.fromEntries(templates[0].fields.map((fl) => [fl.key, fl.default])));
  const [accent, setAccent] = useState<string>(templates[0].accent);
  const [partnerId, setPartnerId] = useState<string>(partners[0]?.id ?? '');
  const [showCoBrand, setShowCoBrand] = useState<boolean>(templates[0].coBrand && partners.length > 0);
  const [copied, setCopied] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const partner = partners.find((p) => p.id === partnerId) ?? null;
  const dim = ASPECT_DIM[tpl.aspect];
  const PREVIEW_W = 460;
  const scale = PREVIEW_W / dim.w;

  function pickTemplate(t: StudioTemplate) {
    setTpl(t);
    setValues(Object.fromEntries(t.fields.map((fl) => [fl.key, fl.default])));
    setAccent(t.accent);
    setShowCoBrand(t.coBrand && partners.length > 0);
  }

  function caption(): string {
    const parts = [values.headline, values.subheadline, values.body, values.cta].filter(Boolean);
    const footer = `\n\n${lo.name}${lo.nmls ? ` · NMLS #${lo.nmls}` : ''}${partner && showCoBrand ? ` × ${partner.name}` : ''}`;
    return parts.join('\n\n') + footer + '\n\nEqual Housing Lender. Not a commitment to lend.';
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(caption());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Caption copied');
  }

  // Export: open the canvas markup full-size in a print window → Save as PDF / image.
  function download() {
    const node = document.getElementById('studio-canvas');
    if (!node) return;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) { toast.error('Allow pop-ups to export'); return; }
    win.document.write(`<!doctype html><html><head><title>${tpl.name}</title><style>@page{size:auto;margin:0}body{margin:0;display:flex;justify-content:center;background:#fff}</style></head><body>${node.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 350);
    toast.success('Opened export — Save as PDF or screenshot');
  }

  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-3 py-2 bg-white text-label focus:outline-none focus:border-[#C9A95C]';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-4">
      {/* Template gallery */}
      <div className="space-y-2 lg:max-h-[78vh] lg:overflow-y-auto">
        <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide">Templates</p>
        {templates.map((t) => {
          const active = t.id === tpl.id;
          const tok = styleTokens(t.style, t.accent);
          return (
            <button
              key={t.id}
              onClick={() => pickTemplate(t)}
              className={`w-full text-left rounded-xl border p-2 transition-all ${active ? 'border-[#C9A95C] ring-2 ring-[#C9A95C]/30' : 'border-border hover:border-[#C9A95C]/40'}`}
            >
              <div className="rounded-lg h-16 flex items-center justify-center mb-1.5" style={{ background: tok.bg }}>
                <ImageIcon size={16} style={{ color: tok.fg, opacity: 0.5 }} />
              </div>
              <p className="text-[12px] font-semibold text-black leading-tight">{t.name}</p>
              <p className="text-[10px] text-label-3">{t.category} · {t.aspect}</p>
            </button>
          );
        })}
      </div>

      {/* Live canvas */}
      <div className="flex flex-col items-center justify-start">
        <div ref={canvasWrapRef} style={{ width: PREVIEW_W, height: dim.h * scale }} className="relative rounded-xl overflow-hidden shadow-card">
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
            <Canvas template={tpl} values={values} accent={accent} lo={lo} partner={partner} showCoBrand={showCoBrand} />
          </div>
        </div>
        <p className="text-[11px] text-label-3 mt-2">{dim.w}×{dim.h}px · live preview</p>
      </div>

      {/* Properties */}
      <div className="space-y-3 lg:max-h-[78vh] lg:overflow-y-auto">
        <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide">Edit</p>
        {tpl.fields.map((fl) => (
          <div key={fl.key}>
            <label className="text-[12px] font-medium text-label-2">{fl.label}</label>
            {fl.multiline ? (
              <textarea rows={3} className={inputCls + ' mt-1'} value={values[fl.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [fl.key]: e.target.value }))} />
            ) : (
              <input className={inputCls + ' mt-1'} value={values[fl.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [fl.key]: e.target.value }))} />
            )}
          </div>
        ))}

        <div>
          <label className="text-[12px] font-medium text-label-2">Accent color</label>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setAccent(c)} className={`w-7 h-7 rounded-full border-2 transition-transform ${accent === c ? 'scale-110 border-black/40' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>

        {partners.length > 0 && (
          <div className="rounded-lg border border-border p-2.5 space-y-2">
            <label className="flex items-center gap-2 text-[12px] font-medium text-label-2">
              <input type="checkbox" checked={showCoBrand} onChange={(e) => setShowCoBrand(e.target.checked)} className="accent-[#C9A95C]" />
              Co-brand with partner
            </label>
            {showCoBrand && (
              <select className={inputCls} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.company ? ` · ${p.company}` : ''}</option>)}
              </select>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button onClick={download} className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-lg text-white" style={{ background: '#0F1D2E' }}>
            <Download size={15} /> Download / Print
          </button>
          <button onClick={copyCaption} className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-lg border border-border text-label hover:bg-fill transition-colors">
            {copied ? <Check size={15} className="text-green" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy caption'}
          </button>
        </div>
        <p className="text-[11px] text-label-3 flex items-start gap-1"><Sparkles size={12} className="mt-0.5 flex-shrink-0 text-[#C9A95C]" /> Edits update the canvas live. Keep required disclosures; avoid specific rate/APR/payment claims.</p>
      </div>
    </div>
  );
}
