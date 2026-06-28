'use client';

/**
 * Phase 151 — AUS (DU/LPA) provider connections (admin). Connect an Automated
 * Underwriting System for origination. Mirrors VoieVendorsCard; never shows the
 * credential.
 */
import { useEffect, useState, useCallback } from 'react';
import { Gavel, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Conn { id: string; vendor: string; api_url: string | null; auth_type: string; account_id: string | null; is_active: boolean; has_credential: boolean; credential_hint: string | null; last_error: string | null }

const VENDORS = [
  { v: 'generic', l: 'Generic MISMO 3.4 gateway' },
  { v: 'fannie_du', l: 'Fannie Mae Desktop Underwriter — coming soon' },
  { v: 'freddie_lpa', l: 'Freddie Mac Loan Product Advisor — coming soon' },
];
const AUTH = [{ v: 'bearer', l: 'Bearer token' }, { v: 'api_key', l: 'API key header' }, { v: 'basic', l: 'Basic auth' }, { v: 'none', l: 'None' }];
const blank = { vendor: 'generic', auth_type: 'bearer', api_url: '', account_id: '', api_key: '', api_secret: '' };

export function AusVendorsCard({ canManage }: { canManage: boolean }) {
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/settings/aus-vendors').then((r) => r.json()).catch(() => ({}));
    setConns(j.connections ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(null); setBusy(true);
    const r = await fetch('/api/settings/aus-vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error ?? 'Could not save.'); return; }
    setShowForm(false); setForm({ ...blank }); load();
  };
  const remove = async (id: string, vendor: string) => {
    if (!confirm(`Disconnect ${vendor}? Past AUS submissions are kept for audit.`)) return;
    await fetch(`/api/settings/aus-vendors?id=${id}`, { method: 'DELETE' }); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--c-text)] tracking-tight flex items-center gap-2"><Gavel size={16} className="text-[var(--c-gold-deep)]" /> Automated Underwriting (DU/LPA)</h2>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Connect an AUS to submit the loan&apos;s MISMO 3.4 file and pull underwriting findings during origination. Any gateway that accepts a MISMO 3.4 upload works via &ldquo;Generic&rdquo;.</p>
        </div>
        {canManage && !showForm && <button onClick={() => { setForm({ ...blank }); setShowForm(true); }} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 shrink-0"><Plus size={14} /> Add provider</button>}
      </div>

      {loading ? <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div> : (
        <div className="space-y-2">
          {conns.length === 0 && !showForm && <div className="text-[13px] text-[var(--c-label2)] border border-dashed border-[var(--c-border)] rounded-[12px] px-4 py-6 text-center">No AUS providers connected yet.</div>}
          {conns.map((c) => (
            <div key={c.id} className="border border-[var(--c-border)] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-[14px] font-semibold text-[var(--c-text)]">{VENDORS.find((v) => v.v === c.vendor)?.l.replace(' — coming soon', '') ?? c.vendor}</span>{!c.is_active && <span className="text-[11px] text-[var(--c-label2)]">inactive</span>}</div>
                <div className="text-[12px] text-[var(--c-label2)] mt-0.5 flex items-center gap-2 flex-wrap">
                  {c.has_credential ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> credential saved {c.credential_hint && `(${c.credential_hint})`}</span> : <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle size={12} /> no credential</span>}
                  {c.api_url ? <span>· endpoint ✓</span> : <span>· no endpoint</span>}
                </div>
                {c.last_error && <div className="text-[11px] text-rose-600 mt-0.5 truncate">{c.last_error}</div>}
              </div>
              {canManage && <button onClick={() => remove(c.id, c.vendor)} className="text-[var(--c-label2)] hover:text-rose-600 shrink-0"><Trash2 size={14} /></button>}
            </div>
          ))}

          {showForm && canManage && (
            <div className="border border-[var(--c-border)] rounded-[12px] p-4 space-y-3 bg-[var(--c-fill)]">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Provider"><select value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputCls}>{VENDORS.map((v) => <option key={v.v} value={v.v}>{v.l}</option>)}</select></Field>
                <Field label="Auth"><select value={form.auth_type} onChange={(e) => setForm({ ...form, auth_type: e.target.value })} className={inputCls}>{AUTH.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
              </div>
              <Field label="AUS endpoint (MISMO 3.4 ingest URL)"><input value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })} placeholder="https://aus.example.com/api/underwrite" className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account / institution id"><input value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={inputCls} /></Field>
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
