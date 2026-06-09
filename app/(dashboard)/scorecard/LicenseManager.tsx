'use client';

/** Phase 50.3 — LO state-license registry (add + expiry-colored grid). */
import { useState } from 'react';
import { Plus, X, ShieldCheck } from 'lucide-react';

interface License { id: string; state: string; nmls_id: string | null; status: string; expiry_date: string }

function tone(expiry: string): { color: string; label: string } {
  const days = Math.round((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { color: 'var(--c-danger)', label: 'Expired' };
  if (days <= 30) return { color: 'var(--c-danger)', label: `${days}d` };
  if (days <= 90) return { color: '#F39C12', label: `${days}d` };
  return { color: '#27AE60', label: new Date(expiry).toLocaleDateString() };
}

export function LicenseManager({ initial }: { initial: License[] }) {
  const [licenses, setLicenses] = useState<License[]>(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ state: '', nmls_id: '', expiry_date: '' });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (form.state.length !== 2 || !form.expiry_date) return;
    setBusy(true);
    try {
      const r = await fetch('/api/lo-licenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (r.ok) { const { license } = await r.json(); setLicenses((l) => [...l.filter((x) => x.state !== license.state), license]); setForm({ state: '', nmls_id: '', expiry_date: '' }); setAdding(false); }
    } finally { setBusy(false); }
  }
  async function del(id: string) { setLicenses((l) => l.filter((x) => x.id !== id)); await fetch(`/api/lo-licenses?id=${id}`, { method: 'DELETE' }); }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-[var(--c-gold-deep)]" /> Licenses</h2>
        <button onClick={() => setAdding((a) => !a)} className="text-[12px] text-[var(--c-gold-deep)] hover:underline inline-flex items-center gap-1"><Plus size={12} /> Add</button>
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3 mb-2 flex items-end gap-2">
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">State</span><input value={form.state} maxLength={2} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} placeholder="GA" className="w-16 mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]" /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">NMLS</span><input value={form.nmls_id} onChange={(e) => setForm((f) => ({ ...f, nmls_id: e.target.value }))} className="w-24 mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]" /></label>
          <label className="block"><span className="text-[11px] text-[var(--c-label2)]">Expires</span><input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} className="mt-0.5 text-[13px] rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1.5 text-[var(--c-text)]" /></label>
          <button onClick={add} disabled={busy} className="h-8 px-3 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-60">Save</button>
        </div>
      )}

      {licenses.length === 0 ? (
        <p className="text-[12px] text-[var(--c-label2)]">No licenses on file. Add the states you&apos;re licensed in to track renewals.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {licenses.map((l) => {
            const t = tone(l.expiry_date);
            return (
              <div key={l.id} className="relative rounded-[10px] border px-2 py-2 text-center" style={{ borderColor: t.color }}>
                <button onClick={() => del(l.id)} className="absolute top-0.5 right-0.5 text-[var(--c-label3)] hover:text-[var(--c-danger)]"><X size={11} /></button>
                <p className="text-[14px] font-bold text-[var(--c-text)]">{l.state}</p>
                <p className="text-[9px]" style={{ color: t.color }}>{t.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
