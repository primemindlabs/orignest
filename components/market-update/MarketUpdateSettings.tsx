'use client';

import { useEffect, useState } from 'react';
import type { RealtorMarketUpdateSettings } from '@/types/marketUpdate';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export function MarketUpdateSettings() {
  const [s, setS] = useState<Partial<RealtorMarketUpdateSettings>>({ auto_send_enabled: false, send_day: 'monday', send_hour_utc: 13, email_subject_prefix: 'This Week in Mortgage Rates' });
  const [saved, setSaved] = useState(false);
  const field = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';

  useEffect(() => {
    fetch('/api/marketing/market-update/settings').then((r) => r.json()).then((d) => d.settings && setS(d.settings));
  }, []);

  async function save(patch: Partial<RealtorMarketUpdateSettings>) {
    const next = { ...s, ...patch };
    setS(next);
    const res = await fetch('/api/marketing/market-update/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Market Update Settings</h2>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>

      <label className="flex items-center justify-between">
        <span className="text-sm text-gray-700">Auto-generate a draft each week</span>
        <button role="switch" aria-checked={!!s.auto_send_enabled} onClick={() => save({ auto_send_enabled: !s.auto_send_enabled })}
          className="relative w-11 h-6 rounded-full transition-colors" style={{ background: s.auto_send_enabled ? '#C9A95C' : '#D6D6D6' }}>
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: s.auto_send_enabled ? 'translateX(20px)' : 'none' }} />
        </button>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Send day</label>
          <select className={field} value={s.send_day} onChange={(e) => save({ send_day: e.target.value })}>
            {DAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Hour (UTC)</label>
          <input type="number" min={0} max={23} className={field} value={s.send_hour_utc ?? 13} onChange={(e) => save({ send_hour_utc: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Email subject prefix</label>
        <input className={field} value={s.email_subject_prefix ?? ''} onChange={(e) => setS({ ...s, email_subject_prefix: e.target.value })} onBlur={(e) => save({ email_subject_prefix: e.target.value })} />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Rate source note (optional)</label>
        <input className={field} value={s.rate_source_note ?? ''} placeholder="e.g. Rates from Freddie Mac PMMS" onChange={(e) => setS({ ...s, rate_source_note: e.target.value })} onBlur={(e) => save({ rate_source_note: e.target.value })} />
      </div>

      <p className="text-xs text-gray-400">Auto-generate creates a draft for your review — it never sends automatically without your approval.</p>
    </div>
  );
}
