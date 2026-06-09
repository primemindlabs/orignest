'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, FileText } from 'lucide-react';

interface Template {
  id: string;
  org_id: string | null;
  loan_program: string;
  condition_text: string;
  category: string;
  priority: string;
  phase: string;
  display_order: number;
  is_custom: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'income', label: 'Income' },
  { value: 'credit', label: 'Credit' },
  { value: 'assets', label: 'Assets' },
  { value: 'property', label: 'Property' },
  { value: 'title', label: 'Title' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
];
const PRIORITY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'prior_to_docs', label: 'Prior to Docs' },
  { value: 'prior_to_funding', label: 'Prior to Funding' },
  { value: 'prior_to_closing', label: 'Prior to Closing' },
];
const PHASE_OPTIONS = [
  { value: 'processing', label: 'Processing' },
  { value: 'underwriting', label: 'Underwriting' },
  { value: 'closing', label: 'Closing' },
  { value: 'post_closing', label: 'Post-Closing' },
];

export function ConditionTemplatesManager({
  initial,
  canEdit,
}: {
  initial: Template[];
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [program, setProgram] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    loan_program: '',
    condition_text: '',
    category: 'other',
    priority: 'standard',
    phase: 'processing',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const programs = useMemo(
    () => Array.from(new Set(templates.map((t) => t.loan_program))).sort(),
    [templates]
  );
  const activeProgram = program || programs[0] || '';
  const visible = templates.filter((t) => t.loan_program === activeProgram);

  async function add() {
    setError(null);
    if (!draft.loan_program.trim() || !draft.condition_text.trim()) {
      setError('Loan program and condition text are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/settings/condition-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not add template.');
      } else {
        setTemplates((cur) => [...cur, json.template]);
        setProgram(json.template.loan_program);
        setDraft({
          loan_program: json.template.loan_program,
          condition_text: '',
          category: 'other',
          priority: 'standard',
          phase: 'processing',
        });
        setAdding(false);
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/condition-templates?id=${id}`, { method: 'DELETE' });
      if (res.ok) setTemplates((cur) => cur.filter((t) => t.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-label-2" />
          <h3 className="text-sm font-semibold text-black">Condition templates</h3>
        </div>
        {canEdit && !adding && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setDraft((d) => ({ ...d, loan_program: activeProgram }));
              setAdding(true);
            }}
          >
            Add condition
          </Button>
        )}
      </div>
      <p className="text-xs text-label-2 mb-4">
        Default checklists auto-populate onto new loans by program. Custom conditions you add apply
        to your org only.
      </p>

      {/* Program tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {programs.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProgram(p)}
            className={`text-[12px] font-medium rounded-full px-3 py-1 transition-colors ${
              p === activeProgram ? 'bg-gold-600 text-white' : 'bg-fill text-label-2 hover:bg-[rgba(0,0,0,0.08)]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-card border border-gold-300 bg-gold-50 p-4 space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Loan program"
              value={draft.loan_program}
              onChange={(e) => setDraft((d) => ({ ...d, loan_program: e.target.value }))}
              placeholder="FHA, Conventional, VA…"
            />
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            />
          </div>
          <Input
            label="Condition text"
            value={draft.condition_text}
            onChange={(e) => setDraft((d) => ({ ...d, condition_text: e.target.value }))}
            placeholder="e.g. Most recent 60 days of bank statements"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
            />
            <Select
              label="Phase"
              options={PHASE_OPTIONS}
              value={draft.phase}
              onChange={(e) => setDraft((d) => ({ ...d, phase: e.target.value }))}
            />
          </div>
          {error && <p className="text-[12px] text-red">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={add} loading={busy}>
              Add
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-border">
        {visible.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] text-black">{t.condition_text}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] text-label-2 bg-fill px-1.5 py-0.5 rounded-full">
                  {t.category}
                </span>
                <span className="text-[10px] text-label-2 bg-fill px-1.5 py-0.5 rounded-full">
                  {t.priority.replace(/_/g, ' ')}
                </span>
                {t.is_custom && (
                  <span className="text-[10px] text-gold-700 bg-gold-50 px-1.5 py-0.5 rounded-full font-medium">
                    custom
                  </span>
                )}
              </div>
            </div>
            {canEdit && t.is_custom && (
              <button
                type="button"
                onClick={() => remove(t.id)}
                disabled={busy}
                className="flex-shrink-0 text-label-3 hover:text-red transition-colors p-1"
                aria-label="Delete condition"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <p className="text-[13px] text-label-3 py-4 text-center">No conditions for this program yet.</p>
        )}
      </div>
    </div>
  );
}
