'use client';

import { useState } from 'react';
import { IconMail, IconCalendar, IconSettings } from '@tabler/icons-react';
import { UpdatePreviewPanel } from '@/components/market-update/UpdatePreviewPanel';
import { RealtorSendList } from '@/components/market-update/RealtorSendList';
import { SendHistoryTable } from '@/components/market-update/SendHistoryTable';
import { MarketUpdateSettings } from '@/components/market-update/MarketUpdateSettings';
import type { RealtorMarketUpdate } from '@/types/marketUpdate';

const RATE_FIELDS = [
  { key: 'rate_30yr_conv', label: '30yr Conv' },
  { key: 'rate_15yr_conv', label: '15yr Conv' },
  { key: 'rate_30yr_fha', label: '30yr FHA' },
  { key: 'rate_30yr_va', label: '30yr VA' },
] as const;

export function MarketUpdateClient() {
  const [tab, setTab] = useState<'compose' | 'history' | 'settings'>('compose');
  const [currentUpdate, setCurrentUpdate] = useState<RealtorMarketUpdate | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rates, setRates] = useState<Record<string, string>>({ rate_30yr_conv: '', rate_15yr_conv: '', rate_30yr_fha: '', rate_30yr_va: '' });
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  const ratesEntered = RATE_FIELDS.every((f) => rates[f.key] !== '' && !isNaN(Number(rates[f.key])));

  async function generate() {
    setGenerating(true);
    setSentMsg(null);
    try {
      const res = await fetch('/api/marketing/market-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(RATE_FIELDS.map((f) => [f.key, parseFloat(rates[f.key])]))),
      });
      const d = await res.json();
      if (res.ok) setCurrentUpdate(d.update);
    } finally { setGenerating(false); }
  }

  async function send() {
    if (!currentUpdate || selected.size === 0) return;
    setSending(true);
    setSentMsg(null);
    try {
      const res = await fetch(`/api/marketing/market-update/${currentUpdate.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realtor_ids: Array.from(selected) }),
      });
      const d = await res.json();
      setSentMsg(res.ok ? `Sent to ${d.sent} realtor${d.sent === 1 ? '' : 's'}.` : (d.error ?? 'Send failed.'));
      if (res.ok) setCurrentUpdate({ ...currentUpdate, status: 'sent' });
    } finally { setSending(false); }
  }

  const tabs = [
    { value: 'compose', label: 'Compose', icon: IconMail },
    { value: 'history', label: 'History', icon: IconCalendar },
    { value: 'settings', label: 'Settings', icon: IconSettings },
  ] as const;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Weekly Market Update</h1>
          <p className="text-sm text-gray-500 mt-0.5">Keep your realtors informed every week.</p>
        </div>
        <div className="flex gap-1">
          {tabs.map(({ value, label, icon: Icon }) => (
            <button key={value} onClick={() => setTab(value)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === value ? 'bg-[#C9A95C] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-semibold text-gray-900 mb-4">Enter Today&apos;s Rates</p>
              <div className="grid grid-cols-2 gap-3">
                {RATE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label} %</label>
                    <input type="number" step="0.001" placeholder="6.750" value={rates[key]} onChange={(e) => setRates((r) => ({ ...r, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30" />
                  </div>
                ))}
              </div>
              <button onClick={generate} disabled={!ratesEntered || generating} className="w-full mt-4 py-3 rounded-xl bg-[#C9A95C] text-white font-semibold text-sm hover:bg-[#b8953f] transition-colors disabled:opacity-40">
                {generating ? 'Generating…' : 'Generate Update'}
              </button>
            </div>
            {currentUpdate && <UpdatePreviewPanel update={currentUpdate} onUpdate={setCurrentUpdate} />}
          </div>
          <div className="space-y-4">
            <RealtorSendList selected={selected} onSelectionChange={setSelected} />
            <button disabled={!currentUpdate || selected.size === 0 || sending} onClick={send} className="w-full py-3 rounded-xl bg-[#C9A95C] text-white font-semibold text-sm hover:bg-[#b8953f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {sending ? 'Sending…' : `Send to ${selected.size} Realtor${selected.size !== 1 ? 's' : ''}`}
            </button>
            {sentMsg && <p className="text-xs text-center text-gray-500">{sentMsg}</p>}
          </div>
        </div>
      )}
      {tab === 'history' && <SendHistoryTable />}
      {tab === 'settings' && <MarketUpdateSettings />}
    </div>
  );
}
