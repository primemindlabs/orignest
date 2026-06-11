'use client';

import { useState } from 'react';
import { IconUserPlus, IconX } from '@tabler/icons-react';
import { formatPhone } from '@/lib/utils';

const GOLD = '#C9A95C';

interface Props {
  phoneNumber: string;
  onSave: (c: { type: 'lead' | 'partner'; name: string; phone: string }) => Promise<void> | void;
  onSkip: () => void;
}

/** Shown after a call to an unrecognized number ends — never during the call. */
export function AddContactPrompt({ phoneNumber, onSave, onSkip }: Props) {
  const [type, setType] = useState<'lead' | 'partner'>('lead');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ type, name: name.trim(), phone: phoneNumber });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onSkip}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl border border-black/[0.08] shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <IconUserPlus size={18} style={{ color: GOLD }} />
            <span className="text-sm font-semibold text-label">Save this number?</span>
          </div>
          <button onClick={onSkip} className="text-label-3 hover:text-label">
            <IconX size={16} />
          </button>
        </div>
        <p className="text-xs text-label-2 mt-1 tabular-nums">{formatPhone(phoneNumber)}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['lead', 'partner'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="text-xs font-semibold py-2 rounded-lg border transition-colors"
              style={
                type === t
                  ? { background: 'rgba(201,169,92,0.14)', borderColor: GOLD, color: '#876830' }
                  : { background: '#fff', borderColor: 'rgba(0,0,0,0.10)', color: '#6B7B8D' }
              }
            >
              {t === 'lead' ? 'Lead (borrower)' : 'Partner (realtor)'}
            </button>
          ))}
        </div>

        <input
          autoFocus
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="mt-3 w-full px-3 py-2 rounded-lg border border-black/[0.10] bg-bg text-sm focus:outline-none focus:border-[#C9A95C]"
        />

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40"
            style={{ background: GOLD }}
          >
            {saving ? 'Saving…' : 'Save contact'}
          </button>
          <button onClick={onSkip} className="px-4 py-2 text-sm font-medium text-label-2 rounded-lg hover:bg-bg">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
