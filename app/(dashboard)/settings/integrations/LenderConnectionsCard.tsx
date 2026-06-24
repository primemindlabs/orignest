'use client';

/**
 * Phase 143 — wholesale lender submission connections (admin). Lists the lenders
 * we can submit MISMO 3.4 files / lock requests to, with an add/edit form. Never
 * shows the stored credential (only a masked hint + "saved" state).
 */
import { useEffect, useState, useCallback } from 'react';
import { Landmark, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Conn {
  id: string;
  lender_name: string;
  platform: string;
  submit_url: string | null;
  lock_url: string | null;
  auth_type: string;
  is_active: boolean;
  has_credential: boolean;
  credential_hint: string | null;
  last_submission_at: string | null;
  last_error: string | null;
}

const PLATFORMS = [
  { v: 'generic_mismo', l: 'Generic MISMO 3.4 (any lender)' },
  { v: 'custom', l: 'Custom endpoint' },
  { v: 'uwm', l: 'UWM (EDGE) — coming soon' },
  { v: 'rocket_tpo', l: 'Rocket Pro TPO — coming soon' },
  { v: 'loanstream', l: 'LoanStream — coming soon' },
];
const AUTH = [{ v: 'bearer', l: 'Bearer token' }, { v: 'api_key', l: 'API key header' }, { v: 'basic', l: 'Basic auth' }, { v: 'none', l: 'None' }];

const blank = { lender_name: '', platform: 'generic_mismo', auth_type: 'bearer', submit_url: '', lock_url: '', api_key: '', api_secret: '' };

export function LenderConnectionsCard({ canManage }: { canManage: boolean }) {
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/settings/lenders');
    const j = await r.json().catch(() => ({}));
    setConns(j.connections ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(null);
    if (!form.lender_name.trim()) { setErr('Lender name is required.'); return; }
    setBusy(true);
    const r = await fetch('/api/settings/lenders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error ?? 'Could not save.'); return; }
    setShowForm(false); setForm({ ...blank }); load();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Disconnect ${name}? Past submissions and locks are kept for audit.`)) return;
    await fetch(`/api/settings/lenders?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--c-text)] tracking-tight flex items-center gap-2"><Landmark size={16} className="text-[var(--c-gold-deep)]" /> Wholesale Lenders</h2>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Submit a loan's MISMO 3.4 file and request rate locks directly. Any lender that accepts a MISMO 3.4 upload works via "Generic MISMO 3.4".</p>
        </div>
        {canManage && !showForm && (
          <button onClick={() => { setForm({ ...blank }); setShowForm(true); }} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 shrink-0"><Plus size={14} /> Add lender</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          {conns.length === 0 && !showForm && <div className="text-[13px] text-[var(--c-label2)] border border-dashed border-[var(--c-border)] rounded-[12px] px-4 py-6 text-center">No wholesale lenders connected yet.</div>}
          {conns.map((c) => (
            <div key={c.id} className="border border-[var(--c-border)] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--c-text)] truncate">{c.lender_name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--c-fill)] text-[var(--c-label2)]">{PLATFORMS.find((p) => p.v === c.platform)?.l.replace(' — coming soon', '') ?? c.platform}</span>
                  {!c.is_active && <span className="text-[11px] text-[var(--c-label2)]">inactive</span>}
                </div>
                <div className="text-[12px] text-[var(--c-label2)] mt-0.5 flex items-center gap-2 flex-wrap">
                  {c.has_credential ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> credential saved {c.credential_hint && `(${c.credential_hint})`}</span> : <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle size={12} /> no credential</span>}
                  {c.submit_url ? <span>· submit ✓</span> : <span>· no submit URL</span>}
                  {c.lock_url ? <span>· lock ✓</span> : null}
                </div>
                {c.last_error && <div className="text-[11px] text-rose-600 mt-0.5 truncate">{c.last_error}</div>}
              </div>
              {canManage && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setForm({ lender_name: c.lender_name, platform: c.platform, auth_type: c.auth_type, submit_url: c.submit_url ?? '', lock_url: c.lock_url ?? '', api_key: '', api_secret: '' }); setShowForm(true); }} className="text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]">Edit</button>
                  <button onClick={() => remove(c.id, c.lender_name)} className="text-[var(--c-label2)] hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}

          {showForm && canManage && (
            <div className="border border-[var(--c-border)] rounded-[12px] p-4 space-y-3 bg-[var(--c-fill)]">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lender name"><input value={form.lender_name} onChange={(e) => setForm({ ...form, lender_name: e.target.value })} placeholder="e.g. Acme Wholesale" className={inputCls} /></Field>
                <Field label="Platform"><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className={inputCls}>{PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></Field>
              </div>
              <Field label="Submission endpoint (MISMO ingest URL)"><input value={form.submit_url} onChange={(e) => setForm({ ...form, submit_url: e.target.value })} placeholder="https://lender.example.com/api/loans/mismo" className={inputCls} /></Field>
              <Field label="Lock endpoint (optional)"><input value={form.lock_url} onChange={(e) => setForm({ ...form, lock_url: e.target.value })} placeholder="https://lender.example.com/api/locks" className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Auth"><select value={form.auth_type} onChange={(e) => setForm({ ...form, auth_type: e.target.value })} className={inputCls}>{AUTH.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
                <Field label={form.auth_type === 'basic' ? 'Username / key' : 'API key / token'}><input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} type="password" placeholder="leave blank to keep existing" className={inputCls} /></Field>
              </div>
              {form.auth_type === 'basic' && <Field label="Password / secret"><input value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} type="password" className={inputCls} /></Field>}
              {err && <div className="text-[12px] text-rose-600">{err}</div>}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
                <button onClick={() => { setShowForm(false); setErr(null); }} className="h-9 px-3 rounded-btn text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">{label}</span>{children}</label>;
}
