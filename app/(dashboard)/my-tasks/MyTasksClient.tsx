'use client';

/** Phase 45.3 — staff task queue: what I need to do today across every file. */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Check, Flag, ArrowRight, CircleDot } from 'lucide-react';

interface Task {
  id: string; lead_id: string; title: string; priority: string; status: string;
  due_date: string | null; requires_lo: boolean; assigned_to: string | null;
  completed_at: string | null;
  leads?: { first_name: string | null; last_name: string | null; loan_amount: number | null } | null;
}

const PRIORITY_COLOR: Record<string, string> = { urgent: 'var(--c-danger)', normal: 'var(--c-gold)', low: 'var(--c-label3)' };

function todayStr() { return new Date().toISOString().slice(0, 10); }

export function MyTasksClient({ myProfileId }: { myProfileId: string | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/loan-tasks?scope=all');
    if (res.ok) setTasks((await res.json()).tasks ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...(body.status ? { status: String(body.status) } : {}), ...(body.flag_for_lo != null ? { requires_lo: Boolean(body.flag_for_lo) } : {}) } : x)));
    await fetch('/api/loan-tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
  }

  const active = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const today = todayStr();
  const urgent = active.filter((t) => t.priority === 'urgent' || (t.due_date && t.due_date <= today));
  const urgentIds = new Set(urgent.map((t) => t.id));
  const mine = active.filter((t) => !urgentIds.has(t.id) && t.assigned_to === myProfileId && t.status !== 'waiting_on_borrower');
  const waiting = active.filter((t) => !urgentIds.has(t.id) && t.status === 'waiting_on_borrower');
  const flagged = active.filter((t) => !urgentIds.has(t.id) && t.requires_lo && t.assigned_to !== myProfileId && t.status !== 'waiting_on_borrower');
  const completedToday = tasks.filter((t) => t.status === 'completed' && t.completed_at && t.completed_at.slice(0, 10) === today);

  function Card({ t }: { t: Task }) {
    const name = `${t.leads?.first_name ?? ''} ${t.leads?.last_name ?? ''}`.trim() || 'Loan';
    const done = t.status === 'completed';
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px]">
        <CircleDot size={12} style={{ color: PRIORITY_COLOR[t.priority] }} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-medium ${done ? 'text-[var(--c-label2)] line-through' : 'text-[var(--c-text)]'} truncate`}>{t.title}</p>
          <p className="text-[11px] text-[var(--c-label2)] truncate">{name}{t.leads?.loan_amount ? ` · $${(t.leads.loan_amount / 1000).toFixed(0)}K` : ''}{t.due_date ? ` · due ${t.due_date}` : ''}{t.requires_lo ? ' · 📢 flagged for LO' : ''}</p>
        </div>
        {!done && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => act(t.id, { status: 'completed' })} title="Mark done" className="w-7 h-7 rounded-[8px] border border-[var(--c-border)] flex items-center justify-center text-[var(--c-label2)] hover:text-green hover:border-green/40"><Check size={13} /></button>
            <button onClick={() => act(t.id, { flag_for_lo: !t.requires_lo })} title="Flag for LO" className={`w-7 h-7 rounded-[8px] border flex items-center justify-center ${t.requires_lo ? 'text-orange border-orange/40' : 'text-[var(--c-label2)] border-[var(--c-border)] hover:text-orange'}`}><Flag size={13} /></button>
            <Link href={`/leads/${t.lead_id}`} title="View loan" className="w-7 h-7 rounded-[8px] border border-[var(--c-border)] flex items-center justify-center text-[var(--c-label2)] hover:text-[var(--c-text)]"><ArrowRight size={13} /></Link>
          </div>
        )}
      </div>
    );
  }

  function Section({ title, rows, variant }: { title: string; rows: Task[]; variant?: 'urgent' | 'waiting' | 'flagged' }) {
    if (rows.length === 0) return null;
    return (
      <div>
        <p className={`text-[12px] font-semibold mb-2 ${variant === 'urgent' ? 'text-[var(--c-danger)]' : 'text-[var(--c-text)]'}`}>{title} · {rows.length}</p>
        <div className="space-y-2">{rows.map((t) => <Card key={t.id} t={t} />)}</div>
      </div>
    );
  }

  if (loading) return <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>;

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[var(--c-label2)]">{urgent.length} urgent · {active.length} open · {waiting.length} waiting on borrower</p>
      {active.length === 0 && completedToday.length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <Check size={22} className="text-green mx-auto mb-2" />
          <p className="text-[14px] font-semibold text-[var(--c-text)]">You&apos;re all caught up</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">No open tasks assigned across your files.</p>
        </div>
      ) : (
        <>
          <Section title="🔴 Urgent" rows={urgent} variant="urgent" />
          <Section title="My action needed" rows={mine} />
          <Section title="⏳ Waiting on borrower" rows={waiting} variant="waiting" />
          <Section title="📢 Flagged for LO" rows={flagged} variant="flagged" />
          <Section title="Completed today" rows={completedToday} />
        </>
      )}
    </div>
  );
}
