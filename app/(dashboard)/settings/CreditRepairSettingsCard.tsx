'use client';

import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';

interface Settings {
  notify_on_item_removed: boolean;
  notify_on_dispute_sent: boolean;
  notify_on_bureau_response: boolean;
  notify_sms_default: boolean;
}

const FIELDS: Array<{ key: keyof Settings; label: string }> = [
  { key: 'notify_on_item_removed', label: 'When an item is removed from a credit report' },
  { key: 'notify_on_bureau_response', label: 'When a bureau responds to a dispute' },
  { key: 'notify_on_dispute_sent', label: 'When a borrower sends dispute letters' },
  { key: 'notify_sms_default', label: 'Also send these as SMS' },
];

const DEFAULTS: Settings = {
  notify_on_item_removed: true,
  notify_on_dispute_sent: false,
  notify_on_bureau_response: true,
  notify_sms_default: false,
};

export function CreditRepairSettingsCard() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/credit-repair/settings');
      if (res.ok) {
        const j = (await res.json()) as { settings: Partial<Settings> | null };
        if (j.settings) setS({ ...DEFAULTS, ...j.settings });
      }
    })();
  }, []);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/credit-repair/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4 flex items-center gap-2">
        <Bell size={14} /> Credit Repair Notifications
      </h3>
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={s[f.key]} onChange={(e) => setS((p) => ({ ...p, [f.key]: e.target.checked }))} className="accent-blue" />
            <span className="text-sm text-black">{f.label}</span>
          </label>
        ))}
      </div>
      <button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors disabled:opacity-50">
        {saved ? <Check size={14} /> : null}
        {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
