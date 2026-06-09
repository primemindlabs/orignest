'use client';

/** Phase 45.2 — delegate a task on this loan to a team member. */
import { useState, useEffect } from 'react';
import { ClipboardList, X } from 'lucide-react';

interface Member { id: string; first_name: string | null; last_name: string | null; role: string }

export function AssignTaskButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState('normal');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open && members.length === 0) fetch('/api/team/members').then((r) => (r.ok ? r.json() : null)).then((d) => d && setMembers(d.members ?? [])).catch(() => undefined);
  }, [open, members.length]);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/loan-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId, title, assigned_to: assignee || null, due_date: due || null, priority }) });
      if (res.ok) { setDone(true); setTitle(''); setAssignee(''); setDue(''); setTimeout(() => { setOpen(false); setDone(false); }, 900); }
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors">
        <ClipboardList size={14} /> Assign task
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="bg-[var(--c-bg)] rounded-[14px] border border-[var(--c-border)] shadow-xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-[var(--c-text)]">Delegate a task</p>
              <button onClick={() => setOpen(false)} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><X size={16} /></button>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing? e.g. Request W2 from borrower" className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[var(--c-text)] focus:outline-none focus:border-[var(--c-gold)]" />
            <div className="grid grid-cols-2 gap-2">
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-[var(--c-text)]">
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.id} value={m.id}>{`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.role}</option>)}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-2 text-[var(--c-text)]">
                <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="low">Low</option>
              </select>
            </div>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[var(--c-text)]" />
            <button onClick={save} disabled={busy || !title.trim()} className="w-full h-9 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 disabled:opacity-60">{done ? 'Assigned ✓' : busy ? 'Assigning…' : 'Assign task'}</button>
          </div>
        </div>
      )}
    </>
  );
}
