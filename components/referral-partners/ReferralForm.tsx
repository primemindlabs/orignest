'use client';

// Phase 121 — public referral capture form (partner shares a client with the LO).
import { useState } from 'react';

const TIMELINES = ['Ready now', '1–3 months', '3–6 months', 'Just exploring'];

export function ReferralForm({ code, loName }: { code: string; loName: string }) {
  const [f, setF] = useState({ borrower_first_name: '', borrower_last_name: '', borrower_email: '', borrower_phone: '', buying_timeline: '', referral_notes: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    setErr(null);
    if (!f.borrower_first_name.trim() || !f.borrower_last_name.trim()) { setErr('Please enter the client first and last name.'); return; }
    setBusy(true);
    const res = await fetch(`/api/refer/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setBusy(false);
    if (res.ok) { setDone(true); return; }
    const j = await res.json().catch(() => ({}));
    setErr(j.error ?? 'Could not submit. Please try again.');
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl mx-auto mb-3">✓</div>
        <p className="font-semibold text-gray-900">Thank you!</p>
        <p className="text-sm text-gray-500 mt-1">{loName} typically reaches out within one business day to help your client get started.</p>
      </div>
    );
  }

  const cls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Refer a client</p>
      <div className="grid grid-cols-2 gap-3">
        <input value={f.borrower_first_name} onChange={set('borrower_first_name')} placeholder="First name" className={cls} />
        <input value={f.borrower_last_name} onChange={set('borrower_last_name')} placeholder="Last name" className={cls} />
      </div>
      <input value={f.borrower_email} onChange={set('borrower_email')} type="email" placeholder="Client email (optional)" className={cls} />
      <input value={f.borrower_phone} onChange={set('borrower_phone')} placeholder="Client phone (optional)" className={cls} />
      <select value={f.buying_timeline} onChange={set('buying_timeline')} className={cls}>
        <option value="">Buying timeline (optional)</option>
        {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <textarea value={f.referral_notes} onChange={set('referral_notes')} rows={2} placeholder="Anything I should know? (optional)" className={`${cls} resize-none`} />
      {err && <p className="text-xs text-red-500">{err}</p>}
      <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-[#C9A95C] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
        {busy ? 'Sending…' : 'Send referral'}
      </button>
    </div>
  );
}
