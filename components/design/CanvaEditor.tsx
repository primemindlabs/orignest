'use client';

// Canva-style design editor: draggable/resizable layers, inline text editing,
// add text/shape/image, color + typography controls, layer ordering, PNG export.
// Built on the DesignDoc model in lib/design/doc.ts — the DOM stage and the PNG
// export render the same document.
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Type, Square, Circle, Image as ImageIcon, Download, Copy, Check, Trash2,
  Copy as Duplicate, ChevronUp, ChevronDown, AlignLeft, AlignCenter, AlignRight,
  Bold, LayoutTemplate, Sparkles,
} from 'lucide-react';
import { templatesForSurface, ASPECT_DIM, type StudioTemplate } from '@/lib/design/studioTemplates';
import {
  buildDocFromTemplate, renderDocToBlob, docCaption, newId, FONT_STACK,
  type DesignDoc, type El, type TextEl, type ShapeEl, type ImageEl, type Background,
} from '@/lib/design/doc';

export interface StudioLO { name: string; nmls: string | null; phone: string | null; }
export interface StudioPartner { id: string; name: string; company: string | null; }

const STAGE_MAX_W = 540;
const STAGE_MAX_H = 560;
const SWATCHES = ['#0f1d2e', '#2563eb', '#0f766e', '#C9A95C', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ffffff', '#111827'];

type DragState = { mode: 'move' | 'resize'; corner?: 'nw' | 'ne' | 'sw' | 'se'; id: string; startX: number; startY: number; orig: El };

export function CanvaEditor({ surface, lo, partners }: { surface: StudioTemplate['surface']; lo: StudioLO; partners: StudioPartner[] }) {
  const templates = useMemo(() => templatesForSurface(surface), [surface]);
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? '');
  const partner = partners.find((p) => p.id === partnerId) ?? null;
  const [showCoBrand, setShowCoBrand] = useState(templates[0].coBrand && partners.length > 0);
  const [activeTpl, setActiveTpl] = useState(templates[0].id);

  const [doc, setDoc] = useState<DesignDoc>(() => buildDocFromTemplate(templates[0], {
    lo, partner: partners[0] ? { name: partners[0].name, company: partners[0].company } : null,
    showCoBrand: templates[0].coBrand && partners.length > 0,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const scale = Math.min(STAGE_MAX_W / doc.width, STAGE_MAX_H / doc.height);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;

  // ── mutations ──────────────────────────────────────────────────────────────
  const patch = useCallback((id: string, p: Partial<El>) => {
    setDoc((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, ...p } as El : e)) }));
  }, []);

  function addElement(el: El) {
    setDoc((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }

  function centerBox(w: number, h: number) {
    return { x: Math.round((doc.width - w) / 2), y: Math.round((doc.height - h) / 2) };
  }

  function addText() {
    const { x, y } = centerBox(560, 80);
    addElement({ id: newId(), type: 'text', name: 'Text', x, y, w: 560, h: 90, text: 'Double-click to edit', fontSize: 48, fontWeight: 700, color: '#111827', align: 'left', lineHeight: 1.15 });
  }
  function addShape(shape: 'rect' | 'ellipse') {
    const { x, y } = centerBox(360, 360);
    addElement({ id: newId(), type: 'shape', shape, name: shape === 'rect' ? 'Rectangle' : 'Ellipse', x, y, w: 360, h: shape === 'ellipse' ? 360 : 220, fill: '#2563eb', radius: 24 });
  }
  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxW = Math.round(doc.width * 0.6);
        const w = Math.min(maxW, img.width);
        const h = Math.round(w * (img.height / img.width));
        const { x, y } = centerBox(w, h);
        addElement({ id: newId(), type: 'image', name: 'Image', x, y, w, h, src, fit: 'cover', radius: 12 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removeSelected() {
    if (!selectedId) return;
    setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  }
  function duplicateSelected() {
    if (!selected) return;
    const clone = { ...selected, id: newId(), x: selected.x + 28, y: selected.y + 28 } as El;
    addElement(clone);
  }
  function reorder(dir: -1 | 1) {
    if (!selectedId) return;
    setDoc((d) => {
      const i = d.elements.findIndex((e) => e.id === selectedId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.elements.length) return d;
      const els = d.elements.slice();
      [els[i], els[j]] = [els[j], els[i]];
      return { ...d, elements: els };
    });
  }

  function loadTemplate(t: StudioTemplate) {
    setActiveTpl(t.id);
    const co = t.coBrand && partners.length > 0;
    setShowCoBrand(co);
    setDoc(buildDocFromTemplate(t, { lo, partner: partner ? { name: partner.name, company: partner.company } : null, showCoBrand: co }));
    setSelectedId(null);
    setEditingId(null);
  }

  function setBackground(bg: Background) {
    setDoc((d) => ({ ...d, background: bg }));
  }

  // ── drag / resize ────────────────────────────────────────────────────────
  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scaleRef.current;
    const dy = (e.clientY - d.startY) / scaleRef.current;
    setDoc((doc) => ({
      ...doc,
      elements: doc.elements.map((el) => {
        if (el.id !== d.id) return el;
        const o = d.orig;
        if (d.mode === 'move') return { ...el, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } as El;
        let { x, y, w, h } = o;
        if (d.corner === 'se') { w = o.w + dx; h = o.h + dy; }
        else if (d.corner === 'ne') { w = o.w + dx; y = o.y + dy; h = o.h - dy; }
        else if (d.corner === 'sw') { x = o.x + dx; w = o.w - dx; h = o.h + dy; }
        else { x = o.x + dx; y = o.y + dy; w = o.w - dx; h = o.h - dy; }
        if (w < 24 || h < 24) return el;
        return { ...el, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } as El;
      }),
    }));
  }, []);

  const onUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [onMove]);

  function startDrag(e: React.PointerEvent, el: El, mode: 'move' | 'resize', corner?: DragState['corner']) {
    if (editingId) return;
    e.stopPropagation();
    setSelectedId(el.id);
    dragRef.current = { mode, corner, id: el.id, startX: e.clientX, startY: e.clientY, orig: { ...el } };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function exportPng() {
    setExporting(true);
    try {
      const blob = await renderDocToBlob(doc, 2);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTpl}-${doc.width}x${doc.height}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported PNG');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(docCaption(doc));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast.success('Caption copied');
  }

  const bg = doc.background.type === 'solid'
    ? doc.background.color
    : `linear-gradient(${doc.background.angle}deg, ${doc.background.from}, ${doc.background.to})`;

  const handleSize = 11 / scale;
  const border = 1.5 / scale;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[190px_1fr_270px] gap-4">
      {/* ── Template gallery ── */}
      <div className="space-y-2 lg:max-h-[78vh] lg:overflow-y-auto pr-1">
        <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide flex items-center gap-1"><LayoutTemplate size={12} /> Templates</p>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => loadTemplate(t)}
            className={`w-full text-left rounded-xl border p-2 transition-all ${activeTpl === t.id ? 'border-[#C9A95C] ring-2 ring-[#C9A95C]/30' : 'border-border hover:border-[#C9A95C]/40'}`}
          >
            <div className="rounded-lg h-14 flex items-center justify-center mb-1.5 text-white/70" style={{ background: t.accent }}>
              <ImageIcon size={15} />
            </div>
            <p className="text-[12px] font-semibold text-black leading-tight">{t.name}</p>
            <p className="text-[10px] text-label-3">{t.category} · {t.aspect}</p>
          </button>
        ))}
      </div>

      {/* ── Stage ── */}
      <div className="flex flex-col items-center">
        {/* toolbar */}
        <div className="flex items-center gap-1 mb-3 flex-wrap justify-center">
          <ToolBtn onClick={addText} icon={<Type size={15} />} label="Text" />
          <ToolBtn onClick={() => addShape('rect')} icon={<Square size={15} />} label="Rect" />
          <ToolBtn onClick={() => addShape('ellipse')} icon={<Circle size={15} />} label="Circle" />
          <ToolBtn onClick={() => fileRef.current?.click()} icon={<ImageIcon size={15} />} label="Image" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <div className="w-px h-6 bg-border mx-1" />
          <button onClick={exportPng} disabled={exporting} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: '#0F1D2E' }}>
            <Download size={14} /> {exporting ? 'Exporting…' : 'PNG'}
          </button>
          <button onClick={copyCaption} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg border border-border text-label hover:bg-fill">
            {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />} Caption
          </button>
        </div>

        <div
          ref={stageRef}
          onPointerDown={() => { setSelectedId(null); setEditingId(null); }}
          className="relative rounded-xl overflow-hidden shadow-card select-none"
          style={{ width: doc.width * scale, height: doc.height * scale, background: bg }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, width: doc.width, height: doc.height }}>
            {doc.elements.map((el) => {
              const isSel = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => startDrag(e, el, 'move')}
                  onDoubleClick={(e) => { if (el.type === 'text') { e.stopPropagation(); setEditingId(el.id); setSelectedId(el.id); } }}
                  style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, cursor: editingId === el.id ? 'text' : 'move', outline: isSel ? `${border}px solid #2563eb` : 'none' }}
                >
                  <ElementBody el={el} editing={editingId === el.id} onText={(text) => patch(el.id, { text })} onBlur={() => setEditingId(null)} />
                  {isSel && !editingId && (['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                    <span
                      key={c}
                      onPointerDown={(e) => startDrag(e, el, 'resize', c)}
                      style={{
                        position: 'absolute', width: handleSize, height: handleSize, background: '#fff', border: `${border}px solid #2563eb`, borderRadius: 2,
                        top: c[0] === 'n' ? -handleSize / 2 : undefined, bottom: c[0] === 's' ? -handleSize / 2 : undefined,
                        left: c[1] === 'w' ? -handleSize / 2 : undefined, right: c[1] === 'e' ? -handleSize / 2 : undefined,
                        cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-label-3 mt-2">{doc.width}×{doc.height}px · drag to move, double-click text to edit</p>
      </div>

      {/* ── Properties ── */}
      <div className="space-y-3 lg:max-h-[78vh] lg:overflow-y-auto pr-1">
        {selected ? (
          <ElementProps el={selected} patch={(p) => patch(selected.id, p)} remove={removeSelected} duplicate={duplicateSelected} reorder={reorder} />
        ) : (
          <CanvasProps doc={doc} setBackground={setBackground} partners={partners} partnerId={partnerId} setPartnerId={setPartnerId} showCoBrand={showCoBrand} setShowCoBrand={setShowCoBrand} reload={() => { const t = templates.find((x) => x.id === activeTpl)!; loadTemplate(t); }} />
        )}
        <p className="text-[11px] text-label-3 flex items-start gap-1 pt-1"><Sparkles size={12} className="mt-0.5 flex-shrink-0 text-[#C9A95C]" /> Keep the disclosure layer; avoid specific rate/APR/payment claims.</p>
      </div>
    </div>
  );
}

// ── element rendering on the stage ─────────────────────────────────────────
function ElementBody({ el, editing, onText, onBlur }: { el: El; editing: boolean; onText: (t: string) => void; onBlur: () => void }) {
  if (el.type === 'shape') {
    return <div style={{ width: '100%', height: '100%', background: el.fill, borderRadius: el.shape === 'ellipse' ? '50%' : el.radius }} />;
  }
  if (el.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: el.fit, borderRadius: el.radius, pointerEvents: 'none' }} />;
  }
  const common: React.CSSProperties = {
    width: '100%', height: '100%', fontFamily: FONT_STACK, fontSize: el.fontSize, fontWeight: el.fontWeight,
    color: el.color, textAlign: el.align, lineHeight: el.lineHeight, fontStyle: el.italic ? 'italic' : 'normal',
    letterSpacing: el.letterSpacing ? el.letterSpacing : undefined, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
  };
  if (editing) {
    return (
      <textarea
        autoFocus
        defaultValue={el.text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onBlur}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ ...common, background: 'transparent', border: 'none', outline: 'none', resize: 'none', padding: 0 }}
      />
    );
  }
  return <div style={common}>{el.text}</div>;
}

// ── toolbar button ─────────────────────────────────────────────────────────
function ToolBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-2 rounded-lg border border-border text-label hover:bg-fill transition-colors">
      {icon} {label}
    </button>
  );
}

// ── property panels ─────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-label-2">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input type="color" value={value.startsWith('#') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded border border-border bg-white cursor-pointer p-0" />
      {SWATCHES.map((c) => (
        <button key={c} onClick={() => onChange(c)} className={`w-5 h-5 rounded-full border ${value === c ? 'ring-2 ring-[#C9A95C]' : 'border-black/10'}`} style={{ background: c }} aria-label={c} />
      ))}
    </div>
  );
}

function ElementProps({ el, patch, remove, duplicate, reorder }: {
  el: El; patch: (p: Partial<El>) => void; remove: () => void; duplicate: () => void; reorder: (d: -1 | 1) => void;
}) {
  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#C9A95C]';
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide">{el.name}</p>

      {el.type === 'text' && (
        <>
          <Field label="Text">
            <textarea rows={3} className={inputCls} value={el.text} onChange={(e) => patch({ text: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <input type="number" className={inputCls} value={(el as TextEl).fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) || 12 })} />
            </Field>
            <Field label="Weight">
              <div className="flex gap-1">
                {[400, 600, 700, 800].map((w) => (
                  <button key={w} onClick={() => patch({ fontWeight: w })} className={`flex-1 text-[11px] py-1.5 rounded-md border ${(el as TextEl).fontWeight === w ? 'border-[#C9A95C] bg-[#C9A95C]/10' : 'border-border'}`}>{w}</button>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex items-center gap-2">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} onClick={() => patch({ align: a })} className={`p-2 rounded-md border ${(el as TextEl).align === a ? 'border-[#C9A95C] bg-[#C9A95C]/10' : 'border-border'}`}>
                {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
              </button>
            ))}
            <button onClick={() => patch({ italic: !(el as TextEl).italic })} className={`p-2 rounded-md border italic font-serif ${(el as TextEl).italic ? 'border-[#C9A95C] bg-[#C9A95C]/10' : 'border-border'}`} style={{ fontFamily: 'Georgia, serif' }}>I</button>
            <button className="p-2 rounded-md border border-border" onClick={() => patch({ fontWeight: (el as TextEl).fontWeight >= 700 ? 400 : 700 })}><Bold size={14} /></button>
          </div>
          <Field label="Color"><ColorRow value={(el as TextEl).color} onChange={(c) => patch({ color: c })} /></Field>
        </>
      )}

      {el.type === 'shape' && (
        <>
          <Field label="Fill"><ColorRow value={(el as ShapeEl).fill} onChange={(c) => patch({ fill: c })} /></Field>
          {(el as ShapeEl).shape === 'rect' && (
            <Field label={`Corner radius · ${(el as ShapeEl).radius}px`}>
              <input type="range" min={0} max={120} value={(el as ShapeEl).radius} onChange={(e) => patch({ radius: Number(e.target.value) })} className="w-full accent-[#C9A95C]" />
            </Field>
          )}
        </>
      )}

      {el.type === 'image' && (
        <>
          <Field label="Fit">
            <div className="flex gap-1">
              {(['cover', 'contain'] as const).map((fv) => (
                <button key={fv} onClick={() => patch({ fit: fv })} className={`flex-1 text-[12px] py-1.5 rounded-md border capitalize ${(el as ImageEl).fit === fv ? 'border-[#C9A95C] bg-[#C9A95C]/10' : 'border-border'}`}>{fv}</button>
              ))}
            </div>
          </Field>
          <Field label={`Corner radius · ${(el as ImageEl).radius}px`}>
            <input type="range" min={0} max={200} value={(el as ImageEl).radius} onChange={(e) => patch({ radius: Number(e.target.value) })} className="w-full accent-[#C9A95C]" />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={() => reorder(1)} className="inline-flex items-center justify-center gap-1 text-[12px] py-1.5 rounded-md border border-border hover:bg-fill"><ChevronUp size={13} /> Forward</button>
        <button onClick={() => reorder(-1)} className="inline-flex items-center justify-center gap-1 text-[12px] py-1.5 rounded-md border border-border hover:bg-fill"><ChevronDown size={13} /> Back</button>
        <button onClick={duplicate} className="inline-flex items-center justify-center gap-1 text-[12px] py-1.5 rounded-md border border-border hover:bg-fill"><Duplicate size={13} /> Duplicate</button>
        <button onClick={remove} className="inline-flex items-center justify-center gap-1 text-[12px] py-1.5 rounded-md border border-red/30 text-red hover:bg-red/5"><Trash2 size={13} /> Delete</button>
      </div>
    </div>
  );
}

function CanvasProps({ doc, setBackground, partners, partnerId, setPartnerId, showCoBrand, setShowCoBrand, reload }: {
  doc: DesignDoc; setBackground: (b: Background) => void; partners: StudioPartner[];
  partnerId: string; setPartnerId: (s: string) => void; showCoBrand: boolean; setShowCoBrand: (b: boolean) => void; reload: () => void;
}) {
  const inputCls = 'w-full text-[13px] rounded-lg border border-border px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#C9A95C]';
  const grad = doc.background;
  const isGradient = grad.type === 'gradient';
  const solidColor = grad.type === 'solid' ? grad.color : grad.from;
  const gradFrom = grad.type === 'gradient' ? grad.from : grad.color;
  const gradTo = grad.type === 'gradient' ? grad.to : '#0f1d2e';
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide">Canvas</p>
      <Field label="Background">
        <div className="flex gap-1 mb-2">
          <button onClick={() => setBackground({ type: 'solid', color: solidColor })} className={`flex-1 text-[12px] py-1.5 rounded-md border ${!isGradient ? 'border-[#C9A95C] bg-[#C9A95C]/10' : 'border-border'}`}>Solid</button>
          <button onClick={() => setBackground({ type: 'gradient', from: gradFrom, to: gradTo, angle: 135 })} className={`flex-1 text-[12px] py-1.5 rounded-md border ${isGradient ? 'border-[#C9A95C] bg-[#C9A95C]/10' : 'border-border'}`}>Gradient</button>
        </div>
        {grad.type === 'solid' ? (
          <ColorRow value={grad.color} onChange={(c) => setBackground({ type: 'solid', color: c })} />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px]"><span className="w-10 text-label-2">From</span><input type="color" value={grad.from} onChange={(e) => setBackground({ type: 'gradient', from: e.target.value, to: grad.to, angle: grad.angle })} className="w-7 h-7 rounded border border-border p-0" /></div>
            <div className="flex items-center gap-2 text-[12px]"><span className="w-10 text-label-2">To</span><input type="color" value={grad.to} onChange={(e) => setBackground({ type: 'gradient', from: grad.from, to: e.target.value, angle: grad.angle })} className="w-7 h-7 rounded border border-border p-0" /></div>
          </div>
        )}
      </Field>

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
          <button onClick={reload} className="w-full text-[12px] py-1.5 rounded-md border border-border hover:bg-fill">Apply to layout</button>
        </div>
      )}
      <p className="text-[11px] text-label-3">Tip: click any layer to edit it. Click empty canvas to deselect.</p>
    </div>
  );
}
