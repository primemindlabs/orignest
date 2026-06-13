'use client';

// Phase 116 — borrower self-service communication preferences (token-gated).
import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';

interface Prefs {
  sms_opted_in: boolean;
  email_opted_in: boolean;
  sms_loan_updates: boolean;
  sms_reminders: boolean;
  sms_marketing: boolean;
  contact_time_start: string;
  contact_time_end: string;
  contact_timezone: string;
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-2 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <span className="text-sm text-gray-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-[#C9A95C]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

export function BorrowerPreferences({ token }: { token: string }) {
  const [p, setP] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/preferences`)
      .then((r) => r.json())
      .then((d) => setP(d.preferences ?? null))
      .catch(() => setP(null));
  }, [token]);

  if (!p) return <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>;
  const set = (patch: Partial<Prefs>) => setP({ ...p, ...patch });

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/borrower-portal/${token}/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    }).catch(() => undefined);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-1">Text messages (SMS)</p>
        <Toggle label="Receive text messages" checked={p.sms_opted_in} onChange={(v) => set({ sms_opted_in: v })} />
        <div className="border-t border-gray-50 mt-1 pt-1">
          <Toggle label="Loan status updates" checked={p.sms_loan_updates} onChange={(v) => set({ sms_loan_updates: v })} disabled={!p.sms_opted_in} />
          <Toggle label="Reminders (documents, appointments)" checked={p.sms_reminders} onChange={(v) => set({ sms_reminders: v })} disabled={!p.sms_opted_in} />
          <Toggle label="Offers & marketing" checked={p.sms_marketing} onChange={(v) => set({ sms_marketing: v })} disabled={!p.sms_opted_in} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-1">Email</p>
        <Toggle label="Receive emails" checked={p.email_opted_in} onChange={(v) => set({ email_opted_in: v })} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-2">Preferred contact hours</p>
        <div className="flex items-center gap-2 text-sm">
          <input type="time" value={p.contact_time_start.slice(0, 5)} onChange={(e) => set({ contact_time_start: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5" />
          <span className="text-gray-400">to</span>
          <input type="time" value={p.contact_time_end.slice(0, 5)} onChange={(e) => set({ contact_time_end: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5" />
        </div>
        <p className="text-xs text-gray-400 mt-2">We’ll only reach out during these hours in your local time.</p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#C9A95C] py-3 text-sm font-semibold text-white hover:brightness-95 transition disabled:opacity-50"
      >
        {saved ? <IconCheck size={16} /> : null}
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save preferences'}
      </button>
      <p className="text-xs text-gray-400 text-center">You can also reply STOP to any text to opt out instantly.</p>
    </div>
  );
}
