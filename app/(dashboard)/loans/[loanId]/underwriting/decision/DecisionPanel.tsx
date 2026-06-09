'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Check, X } from 'lucide-react';

const DECISIONS = [
  { value: 'approve', label: 'Approve', tone: 'var(--c-success)' },
  { value: 'approve_with_conditions', label: 'Approve w/ Conditions', tone: 'var(--c-warning)' },
  { value: 'suspend', label: 'Suspend', tone: 'var(--c-warning)' },
  { value: 'deny', label: 'Deny', tone: 'var(--c-danger)' },
];

export function DecisionPanel({
  loanId,
  initialDecision,
  initialNotes,
}: {
  loanId: string;
  initialDecision: string | null;
  initialNotes: string | null;
}) {
  const [decision, setDecision] = useState(initialDecision ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  async function save() {
    if (!decision) { setStatus({ ok: false, msg: 'Select a decision.' }); return; }
    setSaving(true); setStatus(null);
    const uwStatus = decision === 'deny' ? 'denied' : decision === 'suspend' ? 'suspended' : 'approved';
    try {
      const res = await fetch(`/api/loans/${loanId}/underwriting`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'uw', decision, decision_notes: notes, status: uwStatus }),
      });
      setStatus(res.ok ? { ok: true, msg: 'Decision recorded.' } : { ok: false, msg: 'Save failed.' });
    } catch { setStatus({ ok: false, msg: 'Network error.' }); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5">
        {DECISIONS.map((d) => {
          const active = decision === d.value;
          return (
            <button
              key={d.value}
              onClick={() => setDecision(d.value)}
              className="text-left rounded-[12px] border p-4 transition-colors"
              style={{
                borderColor: active ? d.tone : 'var(--c-border)',
                backgroundColor: active ? 'var(--c-fill)' : 'var(--c-surface)',
              }}
            >
              <span className="text-[14px] font-semibold" style={{ color: active ? d.tone : 'var(--c-text)' }}>{d.label}</span>
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-[13px] font-medium text-[var(--c-text)]">Decision notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mt-1.5 w-full rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[14px] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30"
          placeholder="Rationale, compensating factors, required conditions…"
        />
      </div>

      <div className="flex items-center gap-3 justify-end">
        {status && (
          <span className={`inline-flex items-center gap-1.5 text-[13px] ${status.ok ? 'text-[var(--c-success)]' : 'text-[var(--c-danger)]'}`}>
            {status.ok ? <Check size={14} /> : <X size={14} />} {status.msg}
          </span>
        )}
        <Button onClick={save} loading={saving}>Record decision</Button>
      </div>
    </div>
  );
}
