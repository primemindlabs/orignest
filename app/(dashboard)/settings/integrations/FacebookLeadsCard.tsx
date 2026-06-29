'use client';

/**
 * Facebook Lead Ads connections (admin). Connect a Page (id + long-lived Page access
 * token) so new Lead Ad submissions import in real time via the leadgen webhook.
 */
import { useEffect, useState, useCallback } from 'react';
import { Facebook, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react';

interface Conn { id: string; page_id: string; page_name: string | null; is_active: boolean; has_token: boolean; token_hint: string | null; last_lead_at: string | null; last_error: string | null }
interface Cfg { connections: Conn[]; webhook_url: string; verify_token_configured: boolean; app_secret_configured: boolean }

const blank = { page_id: '', page_name: '', page_access_token: '' };

export function FacebookLeadsCard({ canManage }: { canManage: boolean }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/settings/facebook').then((r) => r.json()).catch(() => null);
    setCfg(j); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(null); setBusy(true);
    const r = await fetch('/api/settings/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error ?? 'Could not save.'); return; }
    setShowForm(false); setForm({ ...blank }); load();
  };
  const remove = async (id: string, page: string) => {
    if (!confirm(`Disconnect Page ${page}? Past imports are kept for audit.`)) return;
    await fetch(`/api/settings/facebook?id=${id}`, { method: 'DELETE' }); load();
  };
  const copyUrl = async () => { if (cfg?.webhook_url) { try { await navigator.clipboard.writeText(cfg.webhook_url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* */ } } };

  const conns = cfg?.connections ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--c-text)] tracking-tight flex items-center gap-2"><Facebook size={16} className="text-[var(--c-gold-deep)]" /> Facebook Lead Ads</h2>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Connect a Facebook/Instagram Page to import Lead Ad submissions the moment they come in (real-time webhook).</p>
        </div>
        {canManage && !showForm && <button onClick={() => { setForm({ ...blank }); setShowForm(true); }} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 shrink-0"><Plus size={14} /> Connect Page</button>}
      </div>

      {loading ? <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div> : (
        <div className="space-y-3">
          {/* Webhook setup */}
          <div className="border border-[var(--c-border)] rounded-[12px] px-4 py-3 bg-[var(--c-fill)] text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--c-label2)]">Webhook URL (subscribe the app&apos;s <code>leadgen</code> field to this):</span>
              {cfg?.webhook_url && <button onClick={copyUrl} className="inline-flex items-center gap-1 text-[var(--c-gold-deep)] hover:underline shrink-0">{copied ? 'Copied' : <><Copy size={11} /> Copy</>}</button>}
            </div>
            <code className="block mt-1 text-[12px] text-[var(--c-text)] break-all">{cfg?.webhook_url || '— set NEXT_PUBLIC_APP_URL —'}</code>
            <div className="flex items-center gap-3 mt-2">
              <Status ok={!!cfg?.verify_token_configured} label="FACEBOOK_VERIFY_TOKEN" />
              <Status ok={!!cfg?.app_secret_configured} label="FACEBOOK_APP_SECRET" />
            </div>
          </div>

          {conns.length === 0 && !showForm && <div className="text-[13px] text-[var(--c-label2)] border border-dashed border-[var(--c-border)] rounded-[12px] px-4 py-6 text-center">No Pages connected yet.</div>}
          {conns.map((c) => (
            <div key={c.id} className="border border-[var(--c-border)] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-[14px] font-semibold text-[var(--c-text)]">{c.page_name || `Page ${c.page_id}`}</span>{!c.is_active && <span className="text-[11px] text-[var(--c-label2)]">inactive</span>}</div>
                <div className="text-[12px] text-[var(--c-label2)] mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>id {c.page_id}</span>
                  {c.has_token ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> token {c.token_hint && `(${c.token_hint})`}</span> : <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle size={12} /> no token</span>}
                  {c.last_lead_at && <span>· last lead {new Date(c.last_lead_at).toLocaleDateString()}</span>}
                </div>
                {c.last_error && <div className="text-[11px] text-rose-600 mt-0.5 truncate">{c.last_error}</div>}
              </div>
              {canManage && <button onClick={() => remove(c.id, c.page_name || c.page_id)} className="text-[var(--c-label2)] hover:text-rose-600 shrink-0"><Trash2 size={14} /></button>}
            </div>
          ))}

          {showForm && canManage && (
            <div className="border border-[var(--c-border)] rounded-[12px] p-4 space-y-3 bg-[var(--c-fill)]">
              <Field label="Page ID"><input value={form.page_id} onChange={(e) => setForm({ ...form, page_id: e.target.value })} placeholder="1234567890" className={inputCls} /></Field>
              <Field label="Page name (label)"><input value={form.page_name} onChange={(e) => setForm({ ...form, page_name: e.target.value })} className={inputCls} /></Field>
              <Field label="Long-lived Page access token"><input value={form.page_access_token} onChange={(e) => setForm({ ...form, page_access_token: e.target.value })} type="password" placeholder="leave blank to keep existing" className={inputCls} /></Field>
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
function Status({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>{ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />} {label}</span>;
}
