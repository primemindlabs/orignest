'use client';

/**
 * Phase 92 — Training & Recording Library. Category sidebar + searchable card grid,
 * per-item completion tracking, an in-app viewer (signed-URL video/audio/pdf or embedded
 * external link), plus manager-only upload + a required-training compliance report.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Video, Headphones, FileText, Link2, Mic, Search, Check, Plus, X, BarChart3, Upload, ChevronRight,
} from 'lucide-react';

interface Category { id: string; name: string; icon: string; sort_order: number }
interface Item {
  id: string; category_id: string | null; title: string; description: string | null;
  content_type: string; storage_path: string | null; external_url: string | null;
  duration_seconds: number | null; tags: string[]; is_required: boolean; created_at: string;
}

const TYPE_ICON: Record<string, React.ElementType> = { video: Video, audio: Headphones, pdf: FileText, link: Link2, recording: Mic };

function duration(s: number | null) {
  if (!s) return null;
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/');
  if (url.match(/vimeo\.com\/(\d+)/)) return `https://player.vimeo.com/video/${url.match(/vimeo\.com\/(\d+)/)![1]}`;
  return null;
}

export function TrainingLibrary() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [canManage, setCanManage] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [viewer, setViewer] = useState<Item | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/training');
    if (res.ok) {
      const d = await res.json();
      setCategories(d.categories ?? []);
      setItems(d.items ?? []);
      setCompleted(new Set(d.completed ?? []));
      setCanManage(!!d.can_manage);
    }
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return items.filter((it) => {
      if (cat === 'required' ? !it.is_required : cat !== 'all' && it.category_id !== cat) return false;
      if (!ql) return true;
      return (it.title + ' ' + (it.description ?? '') + ' ' + it.tags.join(' ')).toLowerCase().includes(ql);
    });
  }, [items, cat, q]);

  const countFor = (id: string) => items.filter((it) => it.category_id === id).length;
  const requiredOutstanding = items.filter((it) => it.is_required && !completed.has(it.id)).length;

  async function markComplete(id: string) {
    setCompleted((s) => new Set(s).add(id));
    await fetch(`/api/training/${id}/complete`, { method: 'POST' });
  }

  if (!loaded) return <p className="text-[13px] text-[var(--c-label2)]">Loading library…</p>;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-[320px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--c-label3)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search training…" className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => setProgressOpen(true)} className="flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><BarChart3 size={14} /> Compliance report</button>
            <Button onClick={() => setUploadOpen(true)}><Plus size={14} /> Add content</Button>
          </div>
        )}
      </div>

      {requiredOutstanding > 0 && (
        <div className="mb-4 rounded-[12px] border border-[var(--c-gold)] bg-[var(--c-gold-light)] px-4 py-2.5 text-[13px] text-[var(--c-gold-deep)]">
          You have <strong>{requiredOutstanding}</strong> required training item{requiredOutstanding > 1 ? 's' : ''} to complete.
        </div>
      )}

      <div className="flex gap-4">
        {/* Category sidebar */}
        <div className="w-[180px] flex-shrink-0 space-y-0.5">
          {[{ id: 'all', name: 'All content' }, { id: 'required', name: 'Required' }, ...categories].map((c) => {
            const active = cat === c.id;
            const count = c.id === 'all' ? items.length : c.id === 'required' ? items.filter((i) => i.is_required).length : countFor(c.id);
            return (
              <button key={c.id} onClick={() => setCat(c.id)} className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[8px] text-[13px] text-left transition-colors ${active ? 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] font-medium' : 'text-[var(--c-label)] hover:bg-[var(--c-fill)]'}`}>
                <span className="truncate">{c.name}</span>
                <span className="text-[11px] text-[var(--c-label3)]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Card grid */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[13px] text-[var(--c-label2)]">No training content here yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((it) => {
                const Icon = TYPE_ICON[it.content_type] ?? FileText;
                const done = completed.has(it.id);
                return (
                  <button key={it.id} onClick={() => setViewer(it)} className="text-left bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 hover:border-[var(--c-gold)] transition-colors flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-9 h-9 rounded-[10px] bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0">
                        <Icon size={17} className="text-[var(--c-gold-deep)]" />
                      </div>
                      {done ? <span className="flex items-center gap-0.5 text-[11px] text-[#2e8c6a]"><Check size={12} /> Done</span> : it.is_required ? <span className="text-[10px] font-semibold text-[var(--c-gold-deep)] bg-[var(--c-gold-light)] rounded-full px-1.5 py-0.5">Required</span> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--c-text)] line-clamp-2">{it.title}</p>
                      {it.description && <p className="text-[11px] text-[var(--c-label2)] line-clamp-2 mt-0.5">{it.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-1 text-[10px] text-[var(--c-label3)]">
                      <span className="capitalize">{it.content_type}</span>
                      {duration(it.duration_seconds) && <span>· {duration(it.duration_seconds)}</span>}
                      <ChevronRight size={12} className="ml-auto" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {viewer && <ViewerModal item={viewer} completed={completed.has(viewer.id)} onClose={() => setViewer(null)} onComplete={() => markComplete(viewer.id)} />}
      {uploadOpen && <UploadModal categories={categories} onClose={() => setUploadOpen(false)} onDone={() => { setUploadOpen(false); load(); }} />}
      {progressOpen && <ProgressModal onClose={() => setProgressOpen(false)} />}
    </div>
  );
}

function ViewerModal({ item, completed, onClose, onComplete }: { item: Item; completed: boolean; onClose: () => void; onComplete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(completed);

  useEffect(() => {
    fetch(`/api/training/${item.id}/url`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setUrl(d.url); setKind(d.kind); } setLoading(false); }).catch(() => setLoading(false));
  }, [item.id]);

  const embed = item.external_url ? embedUrl(item.external_url) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[680px] max-h-[90vh] overflow-y-auto bg-[var(--c-surface)] rounded-[14px] shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--c-text)]">{item.title}</h3>
            {item.description && <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{item.description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} className="text-[var(--c-label2)]" /></button>
        </div>

        <div className="rounded-[12px] overflow-hidden bg-black/5 min-h-[120px] grid place-items-center">
          {loading ? <p className="text-[12px] text-[var(--c-label2)] py-8">Loading…</p>
            : kind === 'external' && embed ? <iframe src={embed} className="w-full aspect-video" allow="fullscreen" allowFullScreen title={item.title} />
            : kind === 'external' && url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[var(--c-gold-deep)] underline py-8">Open content in a new tab →</a>
            : !url ? <p className="text-[12px] text-[var(--c-label2)] py-8">Content unavailable.</p>
            : item.content_type === 'pdf' ? <iframe src={url} className="w-full h-[60vh]" title={item.title} />
            : item.content_type === 'audio' || item.content_type === 'recording' ? <audio controls src={url} className="w-full m-4" />
            : <video controls src={url} className="w-full max-h-[60vh]" />}
        </div>

        <div className="flex items-center justify-end gap-2">
          {done ? <span className="flex items-center gap-1 text-[13px] text-[#2e8c6a]"><Check size={15} /> Completed</span>
            : <Button onClick={() => { setDone(true); onComplete(); }}><Check size={14} /> Mark complete</Button>}
        </div>
      </div>
    </div>
  );
}

function UploadModal({ categories, onClose, onDone }: { categories: Category[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [contentType, setContentType] = useState('video');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setErr('Title is required.'); return; }
    if (!file && !externalUrl.trim()) { setErr('Add a file or paste an external URL.'); return; }
    setSaving(true); setErr(null);
    const fd = new FormData();
    fd.set('title', title.trim());
    fd.set('description', description);
    fd.set('content_type', contentType);
    if (categoryId) fd.set('category_id', categoryId);
    if (externalUrl.trim()) fd.set('external_url', externalUrl.trim());
    if (file) fd.set('file', file);
    fd.set('tags', tags);
    fd.set('is_required', String(required));
    try {
      const res = await fetch('/api/training', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed');
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-[420px] h-full bg-[var(--c-surface)] shadow-2xl overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[var(--c-text)]">Add training content</h3><button onClick={onClose} aria-label="Close"><X size={18} className="text-[var(--c-label2)]" /></button></div>
        {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
        <Field label="Title *"><input value={title} onChange={(e) => setTitle(e.target.value)} className="inp" /></Field>
        <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="inp resize-none" /></Field>
        <Field label="Category">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="inp">
            <option value="">— Uncategorized —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="inp">
            {['video', 'audio', 'pdf', 'link', 'recording'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="External URL (YouTube / Loom / Vimeo)"><input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" className="inp" /></Field>
        <Field label="…or upload a file">
          <label className="flex items-center gap-2 text-[12px] text-[var(--c-label2)] border border-dashed border-[var(--c-border)] rounded-[8px] px-3 py-2 cursor-pointer hover:bg-[var(--c-fill)]">
            <Upload size={14} /> {file ? file.name : 'Choose a video, audio, or PDF'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept="video/*,audio/*,application/pdf" />
          </label>
        </Field>
        <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="fha, objection-handling" className="inp" /></Field>
        <label className="flex items-center gap-2 text-[12px] text-[var(--c-text)]"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required for all LOs</label>
        <Button onClick={submit} disabled={saving} className="w-full">{saving ? 'Uploading…' : 'Publish to library'}</Button>
        <style jsx>{`.inp { width: 100%; font-size: 13px; background: var(--c-fill); border-radius: 8px; padding: 8px 10px; margin-top: 2px; outline: none; }`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-[11px] text-[var(--c-label2)]">{label}</label>{children}</div>;
}

interface ProgressRow { user_id: string; name: string; completed_count: number; rate: number }
function ProgressModal({ onClose }: { onClose: () => void }) {
  const [required, setRequired] = useState<{ id: string; title: string }[]>([]);
  const [members, setMembers] = useState<ProgressRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/training/progress').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setRequired(d.required_items ?? []); setMembers(d.members ?? []); } setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-[480px] max-h-[80vh] overflow-y-auto bg-[var(--c-surface)] rounded-[14px] shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[var(--c-text)]">Required-training compliance</h3><button onClick={onClose} aria-label="Close"><X size={18} className="text-[var(--c-label2)]" /></button></div>
        {!loaded ? <p className="text-[12px] text-[var(--c-label2)]">Loading…</p>
          : required.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No required training items yet. Mark items “Required for all LOs” when adding them.</p>
          : (
            <div className="space-y-1.5">
              <p className="text-[11px] text-[var(--c-label3)]">{required.length} required item{required.length > 1 ? 's' : ''} · {members.length} team member{members.length > 1 ? 's' : ''}</p>
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--c-text)] truncate">{m.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-28 h-1.5 rounded-full bg-[var(--c-fill)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.rate}%`, background: m.rate === 100 ? '#3FB68B' : 'var(--c-gold)' }} /></div>
                    <span className="text-[11px] text-[var(--c-label2)] w-14 text-right">{m.completed_count}/{required.length}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
