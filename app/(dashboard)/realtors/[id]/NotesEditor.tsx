'use client';

/** Phase 40 — editable relationship notes for a realtor. */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';

export function NotesEditor({ realtorId, initial }: { realtorId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/realtors/${realtorId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationship_notes: notes }) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-2">
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Relationship notes — how you met, their preferences, key context…" className="w-full text-[13px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[var(--c-text)] resize-y focus:outline-none focus:border-[var(--c-gold)]" />
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving} variant="secondary">{saving ? 'Saving…' : 'Save notes'}</Button>
        {saved && <span className="text-[12px] text-green inline-flex items-center gap-1"><Check size={13} /> Saved</span>}
      </div>
    </div>
  );
}
