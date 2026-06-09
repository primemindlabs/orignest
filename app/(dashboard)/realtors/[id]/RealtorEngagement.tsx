'use client';

/** Phase 48.9/48.10 — co-marketing cadence + meeting/event logger for a realtor. */
import { useState, useEffect, useCallback } from 'react';
import { CalendarPlus, Check } from 'lucide-react';

const EVENTS = [
  { v: 'coffee', l: 'Coffee' }, { v: 'lunch', l: 'Lunch' }, { v: 'open_house', l: 'Open house' },
  { v: 'industry_event', l: 'Industry event' }, { v: 'virtual', l: 'Virtual' }, { v: 'cold_intro', l: 'Cold intro' },
  { v: 'referral_intro', l: 'Referral intro' }, { v: 'other', l: 'Other' },
];
const CADENCES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'none'];
const today = () => new Date().toISOString().slice(0, 10);

export function RealtorEngagement({ realtorId, initialCadence }: { realtorId: string; initialCadence: string }) {
  const [cadence, setCadence] = useState(initialCadence || 'monthly');
  const [meetings, setMeetings] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ event_type: 'coffee', event_date: today(), event_name: '', notes: '', next_step: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/realtor-meetings?realtor_id=${realtorId}`);
    if (r.ok) setMeetings((await r.json()).meetings ?? []);
  }, [realtorId]);
  useEffect(() => { load(); }, [load]);

  async function setCad(c: string) {
    setCadence(c);
    await fetch('/api/realtor-meetings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ realtor_id: realtorId, comarketing_cadence: c }) });
  }
  async function logMeeting() {
    setBusy(true);
    try {
      const r = await fetch('/api/realtor-meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ realtor_id: realtorId, ...form }) });
      if (r.ok) { setSaved(true); setForm({ event_type: 'coffee', event_date: today(), event_name: '', notes: '', next_step: '' }); setTimeout(() => setSaved(false), 1500); await load(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[12px] font-medium text-[var(--c-text)] mb-2">Co-marketing cadence</p>
        <div className="flex flex-wrap gap-1.5">
          {CADENCES.map((c) => (
            <button key={c} onClick={() => setCad(c)} className={`text-[12px] px-2.5 py-1 rounded-full border capitalize ${cadence === c ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2.5">
        <p className="text-[12px] font-medium text-[var(--c-text)] inline-flex items-center gap-1.5"><CalendarPlus size={13} /> Log a meeting</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.event_type} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))} className="text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]">{EVENTS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}</select>
          <input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} className="text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]" />
        </div>
        <input value={form.event_name} onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))} placeholder="Event name (e.g. KW Bold Buckhead)" className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2.5 py-1.5 text-[var(--c-text)]" />
        <input value={form.next_step} onChange={(e) => setForm((f) => ({ ...f, next_step: e.target.value }))} placeholder="Next step (e.g. follow up in 2 weeks)" className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2.5 py-1.5 text-[var(--c-text)]" />
        <button onClick={logMeeting} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 disabled:opacity-60">{saved ? <><Check size={13} /> Logged</> : busy ? 'Saving…' : 'Log meeting'}</button>
      </div>

      {meetings.length > 0 && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
          {meetings.map((m) => (
            <div key={String(m.id)} className="px-4 py-2.5">
              <p className="text-[13px] text-[var(--c-text)] capitalize">{String(m.event_type).replace('_', ' ')}{m.event_name ? ` · ${m.event_name}` : ''}</p>
              <p className="text-[11px] text-[var(--c-label2)]">{String(m.event_date)}{m.next_step ? ` · next: ${m.next_step}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
