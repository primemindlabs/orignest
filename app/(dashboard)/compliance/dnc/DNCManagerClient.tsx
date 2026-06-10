'use client';

/** Phase 71 (A6) — internal DNC suppression list manager. View + manual add.
 * Removal is intentionally unavailable: dnc_entries is an INSERT-only compliance ledger. */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, ShieldOff } from 'lucide-react';

interface Entry { id: string; phone_number: string; channel: string; source: string; notes: string | null; created_at: string }

export function DNCManagerClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ phone: '', channel: 'all', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { const r = await fetch(`/api/compliance/dnc${q ? `?q=${encodeURIComponent(q)}` : ''}`); if (r.ok) setEntries((await r.json()).entries ?? []); }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function add() {
    if (!form.phone.trim()) return;
    setBusy(true);
    try { const r = await fetch('/api/compliance/dnc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (r.ok) { setAdding(false); setForm({ phone: '', channel: 'all', notes: '' }); load(); } }
    finally { setBusy(false); }
  }

  const inp = 'w-full text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[var(--c-text)]';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--c-label3)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number…" className={`${inp} pl-8`} />
        </div>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-gold)] text-white"><Plus size={14} /> Add number</button>
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3 space-y-2">
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" className={inp} />
          <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className={inp}><option value="all">All channels</option><option value="sms">SMS only</option><option value="voice">Voice only</option></select>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Reason (optional)" className={inp} />
          <div className="flex gap-2"><button onClick={add} disabled={busy} className="h-8 px-4 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Suppress</button><button onClick={() => setAdding(false)} className="h-8 px-4 rounded-btn text-[12px] border border-[var(--c-border)] text-[var(--c-text)]">Cancel</button></div>
        </div>
      )}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-x-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-[var(--c-label2)]"><ShieldOff size={24} className="mb-2 opacity-40" /><p className="text-[13px]">No suppressed numbers.</p></div>
        ) : (
          <table className="w-full text-[13px] min-w-[480px]">
            <thead><tr className="text-[10px] uppercase text-[var(--c-label2)] border-b border-[var(--c-border)]"><th className="text-left px-4 py-2">Number</th><th className="text-left px-4 py-2">Channel</th><th className="text-left px-4 py-2">Source</th><th className="text-left px-4 py-2">Reason</th><th className="text-right px-4 py-2">Added</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[var(--c-border)] last:border-0">
                  <td className="px-4 py-2.5 font-mono text-[var(--c-text)]">{e.phone_number}</td>
                  <td className="px-4 py-2.5 text-[var(--c-label2)]">{e.channel}</td>
                  <td className="px-4 py-2.5 text-[var(--c-label2)]">{e.source}</td>
                  <td className="px-4 py-2.5 text-[var(--c-label2)] truncate max-w-[160px]">{e.notes ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--c-label3)]">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-label2)] italic">This is an append-only compliance ledger — numbers can&apos;t be deleted. A number leaves suppression only when a new express-consent record is captured.</p>
    </div>
  );
}
