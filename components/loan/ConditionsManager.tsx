'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Plus, Check, Circle, Eye, EyeOff } from 'lucide-react';
import { ConditionDocuments } from '@/components/conditions/ConditionDocuments';
import { SubmissionPackageButton } from '@/components/conditions/SubmissionPackageButton';
import { RemindBorrowerButton } from '@/components/loan/RemindBorrowerButton';

export interface Condition {
  id: string;
  condition_text: string;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  is_agent_visible?: boolean;
}

const CATEGORY_OPTIONS = ['income', 'credit', 'assets', 'property', 'title', 'insurance', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const PRIORITY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'prior_to_docs', label: 'Prior to Docs' },
  { value: 'prior_to_funding', label: 'Prior to Funding' },
  { value: 'prior_to_closing', label: 'Prior to Closing' },
];

const STATUS_TONE: Record<string, string> = {
  cleared: 'var(--c-success)', suspended: 'var(--c-danger)', issued: 'var(--c-warning)',
};

export function ConditionsManager({ loanId, initial }: { loanId: string; initial: Condition[] }) {
  const [conditions, setConditions] = useState<Condition[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ condition_text: '', category: 'other', priority: 'standard' });
  const [busy, setBusy] = useState(false);

  const open = conditions.filter((c) => c.status !== 'cleared');
  const cleared = conditions.filter((c) => c.status === 'cleared');

  async function add() {
    if (!draft.condition_text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/conditions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (res.ok) {
        setConditions((c) => [...c, json.condition]);
        setDraft({ condition_text: '', category: 'other', priority: 'standard' });
        setAdding(false);
      }
    } finally { setBusy(false); }
  }

  async function toggle(c: Condition) {
    const next = c.status === 'cleared' ? 'issued' : 'cleared';
    setConditions((cur) => cur.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    try {
      await fetch(`/api/loans/${loanId}/conditions`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, status: next }),
      });
    } catch {
      setConditions((cur) => cur.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
    }
  }

  // A4 — toggle whether the borrower/realtor portal can see this condition.
  async function toggleVisibility(c: Condition) {
    const next = !c.is_agent_visible;
    setConditions((cur) => cur.map((x) => (x.id === c.id ? { ...x, is_agent_visible: next } : x)));
    try {
      await fetch(`/api/loans/${loanId}/conditions`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, agent_visible: next }),
      });
    } catch {
      setConditions((cur) => cur.map((x) => (x.id === c.id ? { ...x, is_agent_visible: c.is_agent_visible } : x)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[var(--c-label2)]">{open.length} open · {cleared.length} cleared</p>
        {!adding && (
          <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>Add condition</Button>
        )}
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-gold)]/40 rounded-[14px] p-4 space-y-3">
          <Input label="Condition" value={draft.condition_text} onChange={(e) => setDraft((d) => ({ ...d, condition_text: e.target.value }))} placeholder="e.g. Most recent 30 days of pay stubs" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" options={CATEGORY_OPTIONS} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
            <Select label="Priority" options={PRIORITY_OPTIONS} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={add} loading={busy}>Add</Button>
          </div>
        </div>
      )}

      {conditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SubmissionPackageButton loanId={loanId} />
          <RemindBorrowerButton loanId={loanId} outstandingCount={open.length} />
        </div>
      )}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
        {conditions.length === 0 && <p className="text-[13px] text-[var(--c-label3)] text-center py-8">No conditions yet.</p>}
        {conditions.map((c) => (
          <div key={c.id} className="flex items-start gap-3 px-4 py-3">
            <button onClick={() => toggle(c)} className="flex-shrink-0 mt-0.5" aria-label="Toggle cleared">
              {c.status === 'cleared'
                ? <span className="w-[18px] h-[18px] rounded-full bg-[var(--c-success)] flex items-center justify-center"><Check size={12} className="text-white" /></span>
                : <Circle size={18} className="text-[var(--c-label3)] hover:text-[var(--c-gold)]" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] ${c.status === 'cleared' ? 'text-[var(--c-label3)] line-through' : 'text-[var(--c-text)]'}`}>{c.condition_text}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] text-[var(--c-label2)] bg-[var(--c-fill)] px-1.5 py-0.5 rounded-full">{c.category}</span>
                <span className="text-[10px] text-[var(--c-label2)] bg-[var(--c-fill)] px-1.5 py-0.5 rounded-full">{c.priority.replace(/_/g, ' ')}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: STATUS_TONE[c.status] ?? 'var(--c-label2)', backgroundColor: 'var(--c-fill)' }}>{c.status.replace(/_/g, ' ')}</span>
                <button onClick={() => toggleVisibility(c)} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--c-fill)]" title={c.is_agent_visible ? 'Visible to borrower/agent portal' : 'Hidden from borrower/agent portal'}>
                  {c.is_agent_visible ? <Eye size={11} className="text-[var(--c-success)]" /> : <EyeOff size={11} className="text-[var(--c-label3)]" />}
                  <span className="text-[var(--c-label2)]">{c.is_agent_visible ? 'Shared' : 'Internal'}</span>
                </button>
              </div>
              <ConditionDocuments conditionId={c.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
