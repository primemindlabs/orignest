'use client';

/** Phase 49.7 — collapsible per-condition document upload (stored in Supabase). */
import { useState, useCallback } from 'react';
import { Paperclip, Upload, X, ChevronDown } from 'lucide-react';

interface Doc { id: string; file_name: string; url: string | null; is_included_in_submission: boolean }

export function ConditionDocuments({ conditionId }: { conditionId: string }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/conditions/${conditionId}/documents`);
    if (r.ok) { const d = (await r.json()).documents ?? []; setDocs(d); setCount(d.length); }
  }, [conditionId]);

  function toggleOpen() { const n = !open; setOpen(n); if (n) load(); }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`/api/conditions/${conditionId}/documents`, { method: 'POST', body: fd });
      if (r.ok) await load();
    } finally { setBusy(false); e.target.value = ''; }
  }
  async function remove(id: string) { await fetch(`/api/conditions/${conditionId}/documents?document_id=${id}`, { method: 'DELETE' }); await load(); }
  async function toggleInc(d: Doc) { await fetch(`/api/conditions/${conditionId}/documents`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: d.id, included: !d.is_included_in_submission }) }); await load(); }

  return (
    <div className="mt-1.5">
      <button onClick={toggleOpen} className="inline-flex items-center gap-1 text-[11px] text-[var(--c-gold-deep)] hover:underline">
        <Paperclip size={11} /> {count && count > 0 ? `${count} document${count > 1 ? 's' : ''}` : 'Upload response documents'}
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div className="mt-2 pl-2 border-l-2 border-[var(--c-border)] space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={d.is_included_in_submission} onChange={() => toggleInc(d)} title="Include in submission package" />
              {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[var(--c-text)] hover:underline truncate flex-1">{d.file_name}</a> : <span className="text-[var(--c-text)] truncate flex-1">{d.file_name}</span>}
              <button onClick={() => remove(d.id)} className="text-[var(--c-label2)] hover:text-[var(--c-danger)]"><X size={12} /></button>
            </div>
          ))}
          <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-gold-deep)] cursor-pointer hover:underline">
            <Upload size={12} /> {busy ? 'Uploading…' : 'Add file'}
            <input type="file" className="hidden" onChange={upload} disabled={busy} />
          </label>
        </div>
      )}
    </div>
  );
}
