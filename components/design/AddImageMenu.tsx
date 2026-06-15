'use client';

/**
 * Phase 138 — Design Studio "Add image" menu: three sources that all resolve to a
 * src the canvas can place — upload a file, generate with AI (fal.ai/Replicate),
 * or import photos from a Zillow listing.
 */
import { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, Sparkles, Home, Loader2, ChevronDown } from 'lucide-react';

type Tab = 'upload' | 'ai' | 'zillow';

export function AddImageMenu({ onAddImage }: { onAddImage: (src: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  // AI
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<'square' | 'story' | 'landscape' | 'portrait'>('square');
  const [genBusy, setGenBusy] = useState(false);

  // Zillow
  const [zUrl, setZUrl] = useState('');
  const [zBusy, setZBusy] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  function pickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { onAddImage(reader.result as string); setOpen(false); };
    reader.readAsDataURL(file);
  }

  async function generate() {
    if (!prompt.trim()) return;
    setGenBusy(true); setError(null);
    try {
      const res = await fetch('/api/design/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, aspect }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Generation failed.');
      onAddImage(j.url);
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { setGenBusy(false); }
  }

  async function importZillow() {
    if (!zUrl.trim()) return;
    setZBusy(true); setError(null); setPhotos([]);
    try {
      const res = await fetch('/api/listings/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zillow_url: zUrl }) });
      const j = await res.json();
      if (j.fallback || !j.listing?.photo_urls?.length) throw new Error(j.reason ?? 'No photos found for that listing.');
      setPhotos(j.listing.photo_urls as string[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setZBusy(false); }
  }

  const tabBtn = (t: Tab, label: string, Icon: typeof Upload) => (
    <button onClick={() => { setTab(t); setError(null); }} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium ${tab === t ? 'bg-[#C9A95C]/15 text-[#8A6310]' : 'text-label-2 hover:bg-fill'}`}>
      <Icon size={13} /> {label}
    </button>
  );
  const inp = 'w-full text-[13px] rounded-lg border border-border px-2.5 py-2 bg-surface text-label focus:outline-none';

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-2 rounded-lg border border-border text-label hover:bg-fill">
        <ImageIcon size={15} /> Image <ChevronDown size={12} />
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }} />

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 left-0 w-[300px] bg-white rounded-xl border border-border shadow-card p-3">
            <div className="flex gap-1 mb-2.5">
              {tabBtn('upload', 'Upload', Upload)}
              {tabBtn('ai', 'AI', Sparkles)}
              {tabBtn('zillow', 'Zillow', Home)}
            </div>

            {tab === 'upload' && (
              <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-border text-[13px] text-label-2 hover:bg-fill">
                <Upload size={15} /> Choose an image…
              </button>
            )}

            {tab === 'ai' && (
              <div className="space-y-2">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Describe the image — e.g. 'modern suburban home at golden hour, welcoming front porch'" className={`${inp} resize-none`} />
                <select value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)} className={inp}>
                  <option value="square">Square (post)</option>
                  <option value="story">Story / Reel (9:16)</option>
                  <option value="landscape">Landscape (16:9)</option>
                  <option value="portrait">Portrait (4:3)</option>
                </select>
                <button onClick={generate} disabled={genBusy || !prompt.trim()} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#C9A95C] text-white text-[13px] font-semibold disabled:opacity-50">
                  {genBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {genBusy ? 'Generating…' : 'Generate'}
                </button>
              </div>
            )}

            {tab === 'zillow' && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input value={zUrl} onChange={(e) => setZUrl(e.target.value)} placeholder="Paste Zillow listing URL" className={inp} />
                  <button onClick={importZillow} disabled={zBusy} className="px-3 rounded-lg bg-[#0F1D2E] text-white text-[12px] font-semibold disabled:opacity-50">{zBusy ? '…' : 'Get'}</button>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
                    {photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p} src={p} alt="" onClick={() => { onAddImage(p); setOpen(false); }} className="w-full h-16 object-cover rounded-md cursor-pointer hover:ring-2 hover:ring-[#C9A95C]" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-[11px] text-red mt-2">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
