'use client';

// Phase 120 — AE response form on the public magic-link page.
import { useState } from 'react';

export function AeRespondForm({ requestId, token }: { requestId: string; token: string }) {
  const [rate, setRate] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!rate && !price && !notes.trim()) { setErr('Enter a rate, price, or note.'); return; }
    setBusy(true);
    const res = await fetch('/api/deal-desk-respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, token, ae_offered_rate: rate || null, ae_offered_price: price || null, ae_response_notes: notes || null }),
    });
    setBusy(false);
    if (res.ok) { setDone(true); return; }
    const j = await res.json().catch(() => ({}));
    setErr(j.error ?? 'Could not submit. The link may have expired.');
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm text-gray-700">
        Thanks — your pricing was sent to the loan officer.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Your pricing</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-400">Offered rate (%)</span>
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="6.25"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400">Price / points</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="100.5"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-gray-400">Notes / conditions</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Subject to AUS approval; 45-day lock available."
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30" />
      </label>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="rounded-xl bg-[#C9A95C] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
        {busy ? 'Sending…' : 'Send pricing'}
      </button>
    </div>
  );
}
