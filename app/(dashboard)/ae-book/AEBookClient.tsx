'use client';

/** Phase 51.3/51.4 — AE Book of Business: brokers by relationship health, add, log touch. */
import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Phone, X, Circle } from 'lucide-react';

interface Broker {
  id: string; company_name: string; address_state: string | null; relationship_health: string;
  volume_ytd: number; submissions_ytd: number; last_submission_at: string | null; last_contact_at: string | null;
  top_loan_types: string[] | null; competitive_notes: string | null;
}

const HEALTH: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#27AE60' }, at_risk: { label: 'At Risk', color: '#F39C12' },
  dormant: { label: 'Dormant', color: 'var(--c-danger)' }, new: { label: 'New', color: '#4A90D9' }, unknown: { label: '—', color: '#6B7B8D' },
};
const ACT = [
  { v: 'call_outbound', l: 'Call' }, { v: 'email_sent', l: 'Email' }, { v: 'in_person_visit', l: 'Visit' },
  { v: 'training_session', l: 'Training' }, { v: 'rate_discussion', l: 'Rate talk' },
];
function days(d: string | null) { return d ? `${Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)}d ago` : 'Never'; }

export function AEBookClient() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ company_name: '', address_state: '', competitive_notes: '' });
  const [logFor, setLogFor] = useState<string | null>(null);
  const [log, setLog] = useState({ activity_type: 'call_outbound', outcome: 'connected', notes: '', follow_up_notes: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/broker-accounts?mine=1');
    if (r.ok) setBrokers((await r.json()).brokers ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!form.company_name.trim()) return;
    setBusy(true);
    try { const r = await fetch('/api/broker-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (r.ok) { setForm({ company_name: '', address_state: '', competitive_notes: '' }); setAdding(false); await load(); } } finally { setBusy(false); }
  }
  async function saveLog() {
    if (!logFor || !log.notes.trim()) return;
    setBusy(true);
    try { const r = await fetch('/api/ae-activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ broker_account_id: logFor, ...log }) }); if (r.ok) { setLogFor(null); setLog({ activity_type: 'call_outbound', outcome: 'connected', notes: '', follow_up_notes: '' }); await load(); } } finally { setBusy(false); }
  }

  const order = ['at_risk', 'dormant', 'active', 'new'];
  const groups = order.map((h) => ({ h, list: brokers.filter((b) => b.relationship_health === h) })).filter((g) => g.list.length);

  if (loading) return <p className="text-[13px] text-[var(--c-label2)]">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[var(--c-label2)]">{brokers.length} brokers in your book</p>
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><Plus size={13} /> Add broker</button>
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2.5">
          <input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Broker company name" className="w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)]" />
          <div className="flex gap-2">
            <input value={form.address_state} maxLength={2} onChange={(e) => setForm((f) => ({ ...f, address_state: e.target.value.toUpperCase() }))} placeholder="State" className="w-20 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)]" />
            <input value={form.competitive_notes} onChange={(e) => setForm((f) => ({ ...f, competitive_notes: e.target.value }))} placeholder="Competitive note (e.g. uses UWM for FHA)" className="flex-1 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)]" />
          </div>
          <button onClick={add} disabled={busy || !form.company_name.trim()} className="h-8 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Add to book</button>
        </div>
      )}

      {brokers.length === 0 && !adding && <p className="text-[13px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[12px] px-4 py-3">No brokers yet. Add your accounts to start tracking relationship health and submissions.</p>}

      {groups.map(({ h, list }) => (
        <div key={h}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: HEALTH[h].color }}>{HEALTH[h].label} · {list.length}</p>
          <div className="space-y-2">
            {list.map((b) => (
              <div key={b.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--c-text)] inline-flex items-center gap-1.5"><Building2 size={13} /> {b.company_name}{b.address_state ? ` · ${b.address_state}` : ''}</p>
                    <p className="text-[11px] text-[var(--c-label2)] mt-0.5">Last submission {days(b.last_submission_at)} · last contact {days(b.last_contact_at)} · {b.submissions_ytd} subs YTD</p>
                    {b.competitive_notes && <p className="text-[11px] text-[#E67E22] mt-1">⚔️ {b.competitive_notes}</p>}
                  </div>
                  <Circle size={9} className="flex-shrink-0 mt-1" style={{ fill: HEALTH[b.relationship_health].color, color: HEALTH[b.relationship_health].color }} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => setLogFor(logFor === b.id ? null : b.id)} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] hover:underline"><Phone size={12} /> Log touch</button>
                </div>
                {logFor === b.id && (
                  <div className="mt-2 pt-2 border-t border-[var(--c-border)] space-y-2">
                    <div className="flex gap-2">
                      <select value={log.activity_type} onChange={(e) => setLog((l) => ({ ...l, activity_type: e.target.value }))} className="text-[12px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]">{ACT.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select>
                      <select value={log.outcome} onChange={(e) => setLog((l) => ({ ...l, outcome: e.target.value }))} className="text-[12px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]">{['connected', 'voicemail', 'no_answer', 'meeting_set', 'submission_expected', 'info_shared'].map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}</select>
                    </div>
                    <input value={log.notes} onChange={(e) => setLog((l) => ({ ...l, notes: e.target.value }))} placeholder="What was discussed?" className="w-full text-[12px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2.5 py-1.5 text-[var(--c-text)]" />
                    <input value={log.follow_up_notes} onChange={(e) => setLog((l) => ({ ...l, follow_up_notes: e.target.value }))} placeholder="Follow-up note (optional)" className="w-full text-[12px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2.5 py-1.5 text-[var(--c-text)]" />
                    <button onClick={saveLog} disabled={busy || !log.notes.trim()} className="h-7 px-3 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Save touch</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
