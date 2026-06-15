// Element-based design document model for the Canva-style editor.
// A DesignDoc is a fixed-pixel canvas with absolutely-positioned layers (text,
// shape, image). The same model drives both the interactive DOM editor and the
// PNG exporter (renderDocToBlob), so what you see is what you export.

import { ASPECT_DIM, type StudioTemplate, type StudioStyle } from './studioTemplates';

export type Background =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number };

export interface BaseEl {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}
export interface TextEl extends BaseEl {
  type: 'text';
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  italic?: boolean;
  lineHeight: number;
  letterSpacing?: number;
}
export interface ShapeEl extends BaseEl {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  fill: string;
  radius: number;
}
export interface ImageEl extends BaseEl {
  type: 'image';
  src: string;
  fit: 'cover' | 'contain';
  radius: number;
}
export type El = TextEl | ShapeEl | ImageEl;

export interface DesignDoc {
  width: number;
  height: number;
  background: Background;
  elements: El[]; // array order === z-order (last = top)
}

export const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `el_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

// ── style → structured tokens (mirrors the old studio look) ──────────────────
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 0xff) + amt), b = clamp((n & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

interface StyleTokens { bg: Background; fg: string; sub: string; eyebrow: string; }

function resolveStyle(style: StudioStyle, accent: string): StyleTokens {
  switch (style) {
    case 'bold-gradient':
      return { bg: { type: 'gradient', from: accent, to: shade(accent, -34), angle: 135 }, fg: '#ffffff', sub: 'rgba(255,255,255,0.86)', eyebrow: '#ffffff' };
    case 'dark-luxe':
      return { bg: { type: 'gradient', from: '#0f1d2e', to: '#1a2a3f', angle: 160 }, fg: '#ffffff', sub: 'rgba(255,255,255,0.8)', eyebrow: accent };
    case 'editorial':
      return { bg: { type: 'solid', color: '#faf8f3' }, fg: '#1a1a1a', sub: '#555555', eyebrow: accent };
    case 'clean-light':
    default:
      return { bg: { type: 'solid', color: '#ffffff' }, fg: '#111827', sub: '#4b5563', eyebrow: accent };
  }
}

export interface DocContext {
  lo: { name: string; nmls: string | null; phone: string | null };
  partner: { name: string; company: string | null } | null;
  showCoBrand: boolean;
}

// Lay a template's copy out as movable, editable elements.
export function buildDocFromTemplate(t: StudioTemplate, ctx: DocContext): DesignDoc {
  const dim = ASPECT_DIM[t.aspect];
  const tok = resolveStyle(t.style, t.accent);
  const P = 80;
  const contentW = dim.w - P * 2;
  const val = (k: string) => t.fields.find((fl) => fl.key === k)?.default ?? '';
  const headlineSize = dim.w >= 1200 ? 60 : t.aspect === 'story' ? 84 : 74;
  const els: El[] = [];

  // accent bar
  els.push({ id: newId(), type: 'shape', shape: 'rect', name: 'Accent bar', x: 0, y: 0, w: 18, h: dim.h, fill: t.accent, radius: 0 });

  let y = P + 8;
  if (val('eyebrow')) {
    els.push({ id: newId(), type: 'text', name: 'Eyebrow', x: P, y, w: contentW, h: 48, text: val('eyebrow'), fontSize: 28, fontWeight: 700, color: tok.eyebrow, align: 'left', lineHeight: 1.1, letterSpacing: 2 });
    y += 78;
  }
  // headline anchored a bit lower so the piece feels designed
  const headlineY = Math.max(y, Math.round(dim.h * 0.26));
  const headlineH = Math.round(headlineSize * 2.5);
  els.push({ id: newId(), type: 'text', name: 'Headline', x: P, y: headlineY, w: contentW, h: headlineH, text: val('headline'), fontSize: headlineSize, fontWeight: 800, color: tok.fg, align: 'left', lineHeight: 1.05, letterSpacing: -1 });
  let cy = headlineY + headlineH + 6;
  if (val('subheadline')) {
    els.push({ id: newId(), type: 'text', name: 'Subheadline', x: P, y: cy, w: contentW, h: 56, text: val('subheadline'), fontSize: 36, fontWeight: 600, color: tok.sub, align: 'left', lineHeight: 1.2 });
    cy += 76;
  }
  if (val('body')) {
    els.push({ id: newId(), type: 'text', name: 'Body', x: P, y: cy, w: Math.round(contentW * 0.9), h: 150, text: val('body'), fontSize: 29, fontWeight: 400, color: tok.sub, align: 'left', lineHeight: 1.4 });
    cy += 170;
  }
  if (val('cta')) {
    const ctaText = val('cta');
    const ctaW = Math.min(contentW, Math.round(ctaText.length * 16 + 70));
    els.push({ id: newId(), type: 'shape', shape: 'rect', name: 'CTA pill', x: P, y: cy, w: ctaW, h: 66, fill: t.accent, radius: 16 });
    els.push({ id: newId(), type: 'text', name: 'CTA text', x: P, y: cy + 18, w: ctaW, h: 40, text: ctaText, fontSize: 28, fontWeight: 700, color: '#ffffff', align: 'center', lineHeight: 1.1 });
  }

  // footer: divider + LO + optional partner
  const footerY = dim.h - P - 130;
  els.push({ id: newId(), type: 'shape', shape: 'rect', name: 'Divider', x: P, y: footerY, w: contentW, h: 2, fill: t.style === 'editorial' ? '#e5e0d5' : 'rgba(127,127,127,0.28)', radius: 0 });
  const half = ctx.showCoBrand && ctx.partner ? Math.round(contentW / 2) - 16 : contentW;
  els.push({ id: newId(), type: 'text', name: 'Your name', x: P, y: footerY + 22, w: half, h: 44, text: ctx.lo.name || 'Your Name', fontSize: 30, fontWeight: 800, color: tok.fg, align: 'left', lineHeight: 1.1 });
  els.push({ id: newId(), type: 'text', name: 'Your details', x: P, y: footerY + 64, w: half, h: 36, text: `${ctx.lo.nmls ? `NMLS #${ctx.lo.nmls}` : 'Loan Officer'}${ctx.lo.phone ? ` · ${ctx.lo.phone}` : ''}`, fontSize: 23, fontWeight: 500, color: tok.sub, align: 'left', lineHeight: 1.1 });
  if (ctx.showCoBrand && ctx.partner) {
    const rx = P + Math.round(contentW / 2) + 16;
    els.push({ id: newId(), type: 'text', name: 'Partner name', x: rx, y: footerY + 22, w: Math.round(contentW / 2) - 16, h: 44, text: ctx.partner.name, fontSize: 30, fontWeight: 800, color: tok.fg, align: 'right', lineHeight: 1.1 });
    els.push({ id: newId(), type: 'text', name: 'Partner company', x: rx, y: footerY + 64, w: Math.round(contentW / 2) - 16, h: 36, text: ctx.partner.company ?? 'Real Estate Partner', fontSize: 23, fontWeight: 500, color: tok.sub, align: 'right', lineHeight: 1.1 });
  }

  // disclosure
  els.push({ id: newId(), type: 'text', name: 'Disclosure', x: P, y: dim.h - 64, w: contentW, h: 30, text: 'Equal Housing Lender. Not a commitment to lend. Subject to credit approval.', fontSize: 17, fontWeight: 400, color: tok.sub, align: 'left', lineHeight: 1.2 });

  return { width: dim.w, height: dim.h, background: tok.bg, elements: els };
}

// Caption from the text layers, top-to-bottom.
export function docCaption(doc: DesignDoc): string {
  return doc.elements
    .filter((e): e is TextEl => e.type === 'text')
    .slice()
    .sort((a, b) => a.y - b.y)
    .map((e) => e.text.trim())
    .filter(Boolean)
    .join('\n\n');
}

// ── PNG export: render the doc to an offscreen canvas ───────────────────────
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') { out.push(''); continue; }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderDocToBlob(doc: DesignDoc, scale = 2): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = doc.width * scale;
  canvas.height = doc.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.scale(scale, scale);

  // background
  if (doc.background.type === 'solid') {
    ctx.fillStyle = doc.background.color;
  } else {
    const rad = (doc.background.angle * Math.PI) / 180;
    const cx = doc.width / 2, cy = doc.height / 2;
    const len = Math.max(doc.width, doc.height);
    const dx = Math.cos(rad) * len / 2, dy = Math.sin(rad) * len / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, doc.background.from);
    g.addColorStop(1, doc.background.to);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, doc.width, doc.height);

  for (const el of doc.elements) {
    if (el.type === 'shape') {
      ctx.fillStyle = el.fill;
      if (el.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        roundRectPath(ctx, el.x, el.y, el.w, el.h, el.radius);
        ctx.fill();
      }
    } else if (el.type === 'image') {
      try {
        const img = await loadImage(el.src);
        ctx.save();
        roundRectPath(ctx, el.x, el.y, el.w, el.h, el.radius);
        ctx.clip();
        const ir = img.width / img.height;
        const br = el.w / el.h;
        let dw = el.w, dh = el.h, dx = el.x, dy = el.y;
        if (el.fit === 'cover' ? ir > br : ir < br) {
          dh = el.h; dw = el.h * ir; dx = el.x - (dw - el.w) / 2;
        } else {
          dw = el.w; dh = el.w / ir; dy = el.y - (dh - el.h) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } catch {
        /* skip unreadable image */
      }
    } else {
      ctx.fillStyle = el.color;
      ctx.textBaseline = 'top';
      ctx.textAlign = el.align;
      try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${el.letterSpacing ?? 0}px`; } catch { /* unsupported */ }
      ctx.font = `${el.italic ? 'italic ' : ''}${el.fontWeight} ${el.fontSize}px ${FONT_STACK}`;
      const lineH = el.fontSize * el.lineHeight;
      const tx = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
      let ty = el.y;
      for (const line of wrapLines(ctx, el.text, el.w)) {
        ctx.fillText(line, tx, ty);
        ty += lineH;
      }
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png');
  });
}
