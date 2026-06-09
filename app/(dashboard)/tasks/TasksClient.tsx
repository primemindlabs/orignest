'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  lead_id: string;
  lead_name: string | null;
}

const PRIORITY_COLOR: Record<TaskRow['priority'], string> = {
  urgent: 'bg-red',
  high: 'bg-orange',
  medium: 'bg-gold-500',
  low: 'bg-label-3',
};

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bucketOf(t: TaskRow): 'overdue' | 'today' | 'upcoming' | 'no_date' {
  if (!t.due_date) return 'no_date';
  const due = new Date(t.due_date).getTime();
  const todayStart = startOfToday();
  const tomorrowStart = todayStart + 86_400_000;
  if (due < todayStart) return 'overdue';
  if (due < tomorrowStart) return 'today';
  return 'upcoming';
}

const GROUPS: { key: 'overdue' | 'today' | 'upcoming' | 'no_date'; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'no_date', label: 'No Due Date' },
];

export function TasksClient({ initial }: { initial: TaskRow[] }) {
  const [tasks, setTasks] = useState<TaskRow[]>(initial);
  const [showCompleted, setShowCompleted] = useState(false);

  async function toggle(id: string, completed: boolean) {
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, completed } : t)));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure.
      setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
    }
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const grouped = useMemo(() => {
    const g: Record<string, TaskRow[]> = { overdue: [], today: [], upcoming: [], no_date: [] };
    for (const t of open) g[bucketOf(t)].push(t);
    return g;
  }, [open]);

  if (tasks.length === 0) {
    return (
      <div className="bg-surface rounded-card shadow-card border border-border p-10 text-center">
        <p className="text-sm text-label-2">No tasks yet. Tasks created on a lead show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(({ key, label }) => {
        const items = grouped[key];
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <h3
              className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${
                key === 'overdue' ? 'text-red' : 'text-label-2'
              }`}
            >
              {label} · {items.length}
            </h3>
            <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden divide-y divide-border">
              {items.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={toggle} />
              ))}
            </div>
          </div>
        );
      })}

      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="text-[12px] font-medium text-label-2 hover:text-black transition-colors"
          >
            {showCompleted ? 'Hide' : 'Show'} completed ({done.length})
          </button>
          {showCompleted && (
            <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden divide-y divide-border mt-2">
              {done.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={toggle} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
}: {
  task: TaskRow;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const due = task.due_date ? new Date(task.due_date) : null;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className="flex-shrink-0 mt-0.5"
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed ? (
          <span className="w-[18px] h-[18px] rounded-full bg-green flex items-center justify-center">
            <Check size={12} className="text-white" />
          </span>
        ) : (
          <Circle size={18} className="text-label-3 hover:text-gold-600 transition-colors" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLOR[task.priority]}`} />
          <p className={`text-[13px] font-medium ${task.completed ? 'text-label-3 line-through' : 'text-black'}`}>
            {task.title}
          </p>
        </div>
        {task.description && (
          <p className="text-[12px] text-label-2 mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {task.lead_name && (
            <Link
              href={`/leads/${task.lead_id}`}
              className="text-[11px] text-gold-700 hover:underline"
            >
              {task.lead_name}
            </Link>
          )}
          {due && (
            <span className="text-[11px] text-label-3">
              {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
