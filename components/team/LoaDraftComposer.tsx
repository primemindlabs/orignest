'use client';

/** Phase 133 — LOA composes a message draft routed to their LO for approval. */
import { useState } from 'react';
import { IconPencil } from '@tabler/icons-react';

export function LoaDraftComposer({ files }: { files: { id: string; name: string }[] }) {
  const [fileId, setFileId] = useState('');
  const [type, setType] = useState<'sms' | 'email'>('sms');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const field = 'w-full h-9 px-3 rounded-[10px] text-sm bg-white border border-[var(--c-border)] text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[#C9A95C]';

  async function submit() {
    if (!fileId || !text.trim()) { setMsg({ kind: 'err', text: 'Pick a file and write a message.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/loa/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loan_id: fileId, contact_id: fileId, draft_type: type, draft_text: text.trim(), draft_subject: type === 'email' ? subject.trim() : null }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ kind: 'err', text: d.error ?? 'Could not save draft.' }); return; }
      setMsg({ kind: 'ok', text: 'Draft sent to your loan officer for review.' });
      setText(''); setSubject('');
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2.5">
      <p className="text-[13px] font-semibold text-[var(--c-text)] flex items-center gap-1.5"><IconPencil size={15} className="text-[var(--c-label2)]" /> Draft a message for review</p>
      <div className="grid grid-cols-2 gap-2">
        <select className={field} value={fileId} onChange={(e) => setFileId(e.target.value)}>
          <option value="">Select a file…</option>
          {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className={field} value={type} onChange={(e) => setType(e.target.value as 'sms' | 'email')}>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>
      {type === 'email' && <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write the message your LO will review and send…" className="w-full px-3 py-2 rounded-[10px] text-sm bg-white border border-[var(--c-border)] text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[#C9A95C] resize-none" />
      {msg && <p className={`text-[12px] ${msg.kind === 'err' ? 'text-red-600' : 'text-green-600'}`}>{msg.text}</p>}
      <button onClick={submit} disabled={busy} className="h-9 px-4 rounded-[10px] text-sm font-medium text-white disabled:opacity-50" style={{ background: '#C9A95C' }}>
        {busy ? 'Sending…' : 'Send for review'}
      </button>
    </div>
  );
}
