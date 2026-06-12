'use client';

import { useState } from 'react';

type Outcome = 'approved' | 'denied' | 'pending' | 'cancelled';

interface Props {
  onSave: (outcome: Outcome, notes: string) => Promise<void>;
  saving: boolean;
}

const OPTIONS: { value: Outcome; label: string; cls: string }[] = [
  { value: 'approved', label: 'Approved', cls: 'bg-green-50 border-green-200 text-green-700' },
  { value: 'denied', label: 'Denied', cls: 'bg-red-50 border-red-200 text-red-700' },
  { value: 'pending', label: 'Pending', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-gray-50 border-gray-200 text-gray-500' },
];

export function OutcomeLogger({ onSave, saving }: Props) {
  const [outcome, setOutcome] = useState<Outcome>('pending');
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Outcome</p>
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setOutcome(o.value)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                outcome === o.value ? o.cls : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Notes (optional)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Cost confirmed, terms accepted, etc."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 resize-none"
        />
      </div>

      <button
        onClick={() => onSave(outcome, notes)}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-[#C9A95C] text-white text-sm font-semibold hover:brightness-95 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save & Log Outcome'}
      </button>
    </div>
  );
}
