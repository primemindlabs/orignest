'use client';

// Phase 89b — compose a forum question and pick which of your AEs to email.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import { FORUM_CATEGORIES, type ForumCategory } from '@/lib/aeForum/categories';

interface AE { id: string; ae_name: string; lender_name: string }

export function PostQuestionModal({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [aes, setAes] = useState<AE[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<ForumCategory>('program');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/lender-aes')
      .then((r) => (r.ok ? r.json() : { aes: [] }))
      .then((d) => {
        const list: AE[] = (d.aes ?? []).map((a: AE) => ({ id: a.id, ae_name: a.ae_name, lender_name: a.lender_name }));
        setAes(list);
        setSelected(new Set(list.map((a) => a.id))); // default: notify all
      })
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function submit() {
    if (!title.trim()) { setErr('Add a question.'); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch('/api/ae-forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null, category, notified_ae_ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to post');
      onPosted();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to post'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-[var(--c-surface)] rounded-[14px] shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-[var(--c-text)]">Ask your AEs</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} className="text-[var(--c-label2)]" /></button>
        </div>

        <div>
          <label className="text-[11px] text-[var(--c-label2)]">Category</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {FORUM_CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} className={`text-[12px] px-2.5 py-1 rounded-full border ${category === c.key ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-[var(--c-label2)]">Question *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Anyone do 90% LTV on a DSCR cash-out?" className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
        </div>
        <div>
          <label className="text-[11px] text-[var(--c-label2)]">Details (optional — included in the email)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full text-[13px] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-2 mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-[var(--c-label2)]">Notify AEs ({selected.size}/{aes.length})</label>
            {aes.length > 0 && (
              <button onClick={() => setSelected(selected.size === aes.length ? new Set() : new Set(aes.map((a) => a.id)))} className="text-[11px] text-[var(--c-gold-deep)]">
                {selected.size === aes.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          {aes.length === 0 ? (
            <p className="text-[12px] text-[var(--c-label2)] mt-1">No AEs in your directory yet — add some on the Directory tab. You can still post the question for the team.</p>
          ) : (
            <div className="max-h-[160px] overflow-y-auto mt-1 space-y-0.5">
              {aes.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-[12px] text-[var(--c-text)] px-1.5 py-1 rounded-[6px] hover:bg-[var(--c-fill)]">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                  <span>{a.ae_name} <span className="text-[var(--c-label3)]">· {a.lender_name}</span></span>
                </label>
              ))}
            </div>
          )}
        </div>

        {err && <p className="text-[12px] text-[var(--c-danger)]">{err}</p>}
        <Button onClick={submit} disabled={saving} className="w-full">{saving ? 'Posting…' : `Post${selected.size ? ` & email ${selected.size} AE${selected.size > 1 ? 's' : ''}` : ''}`}</Button>
        <p className="text-[10px] text-[var(--c-label3)] text-center">AE answers post back here for the whole team. Email delivery is enabled when RESEND is configured; otherwise capture replies with “Add AE response”.</p>
      </div>
    </div>
  );
}
