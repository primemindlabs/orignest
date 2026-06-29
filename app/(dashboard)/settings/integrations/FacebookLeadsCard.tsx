'use client';

/**
 * Facebook Lead Ads connections (admin). Self-serve via "Connect with Facebook"
 * (OAuth → pick Page(s) → auto-subscribed to the leadgen webhook). Manual Page-token
 * entry remains as an advanced fallback.
 */
import { useEffect, useState, useCallback } from 'react';
import { Facebook, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Copy, Power } from 'lucide-react';

interface Conn { id: string; page_id: string; page_name: string | null; is_active: boolean; has_token: boolean; token_hint: string | null; last_lead_at: string | null; last_error: string | null }
interface Cfg { connections: Conn[]; webhook_url: string; verify_token_configured: boolean; app_secret_configured: boolean; oauth_available: boolean }

const blank = { page_id: '', page_name: '', page_access_token: '' };

const BANNERS: Record<string, { tone: 'ok' | 'warn' | 'err'; text: string }> = {
  pages_found: { tone: 'ok', text: 'Connected to Facebook. Enable the Page(s) you want to receive leads from below.' },
  denied: { tone: 'warn', text: 'Facebook connection was cancelled.' },
  error: { tone: 'err', text: 'Could not complete the Facebook connection. Please try again.' },
  not_configured: { tone: 'err', text: 'Facebook Login isn’t configured on this platform yet.' },
  no_pages: { tone: 'warn', text: 'No Facebook Pages were found on that account.' },
  forbidden: { tone: 'err', text: 'Only admins can connect Facebook.' },
};

export function FacebookLeadsCard({ canManage }: { canManage: boolean }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/settings/facebook').then((r) => r.json()).catch(() => null);
    setCfg(j); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Surface the OAuth redirect result (?facebook=...), then clean the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const status = p.get('facebook');
    if (status && BANNERS[status]) {
      const count = p.get('count');
      const b = BANNERS[status];
      setBanner(status === 'pages_found' && count ? { ...b, text: `Connected to Facebook — found ${count} Page(s). Enable the one(s) you want below.` } : b);
      const clean = new URL(window.location.href); clean.searchParams.delete('facebook'); clean.searchParams.delete('count');
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  const toggleActive = async (c: Conn) => {
    setBusyId(c.id);
    const r = await fetch('/api/settings/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: c.page_id, is_active: !c.is_active }) });
    const j = await r.json().catch(() => ({}));
    setBusyId(null);
    if (j?.warning) setBanner({ tone: 'warn', text: j.warning });
    load();
  };
  const save = async () => {
    setErr(null); setBusy(true);
    const r = await fetch('/api/settings/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, is_active: true }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    if (j?.warning) setBanner({ tone: 'warn', text: j.warning });
    setShowForm(false); setForm({ ...blank }); load();
  };
  const remove = async (id: string, page: string) => {
    if (!confirm(`Disconnect Page ${page}? Past imports are kept for audit.`)) return;
    setBusyId(id);
    await fetch(`/api/settings/facebook?id=${id}`, { method: 'DELETE' });
    setBusyId(null); load();
  };
  const copyUrl = async () => { if (cfg?.webhook_url) { try { await navigator.clipboard.writeText(cfg.webhook_url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* */ } } };

  const conns = cfg?.connections ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--c-text)] tracking-tight flex items-center gap-2"><Facebook size={16} className="text-[var(--c-gold-deep)]" /> Facebook Lead Ads</h2>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Connect your Facebook/Instagram Page to import Lead Ad submissions the instant they come in.</p>
        </div>
        {canManage && cfg?.oauth_available && (
          <a href="/api/integrations/facebook/oauth/start" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[#1877F2] text-white hover:opacity-90 shrink-0"><Facebook size={14} /> Connect with Facebook</a>
        )}
      </div>

      {banner && (
        <div className={`flex items-start gap-2 text-[13px] rounded-[12px] px-3.5 py-2.5 border mb-3 ${banner.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : banner.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {banner.tone === 'ok' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}<span>{banner.text}</span>
        </div>
      )}

      {loading ? <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-4"><Loader2 size={14} className="animate-spin" /> Loading…</div> : (
        <div className="space-y-3">
          {!cfg?.oauth_available && (
            <div className="border border-amber-200 bg-amber-50 rounded-[12px] px-4 py-3 text-[12px] text-amber-800">
              One-click connect isn’t available yet — set <code>FACEBOOK_APP_ID</code> + <code>FACEBOOK_APP_SECRET</code> on the platform. You can still connect a Page manually below.
            </div>
          )}

          {conns.length === 0 && !showForm && <div className="text-[13px] text-[var(--c-label2)] border border-dashed border-[var(--c-border)] rounded-[12px] px-4 py-6 text-center">No Pages connected yet.{cfg?.oauth_available ? ' Click “Connect with Facebook” to begin.' : ''}</div>}

          {conns.map((c) => (
            <div key={c.id} className="border border-[var(--c-border)] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--c-text)]">{c.page_name || `Page ${c.page_id}`}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--c-fill)] text-[var(--c-label2)]'}`}>{c.is_active ? 'receiving leads' : 'paused'}</span>
                </div>
                <div className="text-[12px] text-[var(--c-label2)] mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>id {c.page_id}</span>
                  {c.has_token ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> token saved</span> : <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle size={12} /> no token</span>}
                  {c.last_lead_at && <span>· last lead {new Date(c.last_lead_at).toLocaleDateString()}</span>}
                </div>
                {c.last_error && <div className="text-[11px] text-rose-600 mt-0.5 truncate">{c.last_error}</div>}
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleActive(c)} disabled={busyId === c.id} title={c.is_active ? 'Pause' : 'Enable'} className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-btn text-[12px] font-medium ${c.is_active ? 'bg-[var(--c-fill)] text-[var(--c-label2)] hover:text-[var(--c-text)]' : 'bg-emerald-600 text-white hover:opacity-90'}`}>
                    {busyId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}{c.is_active ? 'Pause' : 'Enable'}
                  </button>
                  <button onClick={() => remove(c.id, c.page_name || c.page_id)} disabled={busyId === c.id} className="text-[var(--c-label2)] hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}

          {/* Advanced: manual Page-token entry + platform webhook config */}
          {canManage && (
            showForm ? (
              <div className="border border-[var(--c-border)] rounded-[12px] p-4 space-y-3 bg-[var(--c-fill)]">
                <p className="text-[12px] font-semibold text-[var(--c-label2)]">Add a Page manually (advanced)</p>
                <Field label="Page ID"><input value={form.page_id} onChange={(e) => setForm({ ...form, page_id: e.target.value })} placeholder="1234567890" className={inputCls} /></Field>
                <Field label="Page name (label)"><input value={form.page_name} onChange={(e) => setForm({ ...form, page_name: e.target.value })} className={inputCls} /></Field>
                <Field label="Long-lived Page access token"><input value={form.page_access_token} onChange={(e) => setForm({ ...form, page_access_token: e.target.value })} type="password" className={inputCls} /></Field>
                {err && <div className="text-[12px] text-rose-600">{err}</div>}
                <div className="flex items-center gap-2">
                  <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save & enable</button>
                  <button onClick={() => { setShowForm(false); setErr(null); }} className="h-9 px-3 rounded-btn text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)]">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setForm({ ...blank }); setShowForm(true); }} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><Plus size={13} /> Add a Page manually</button>
            )
          )}

          <details className="text-[12px] text-[var(--c-label2)]">
            <summary className="cursor-pointer">Platform webhook details</summary>
            <div className="mt-2 border border-[var(--c-border)] rounded-[12px] px-4 py-3 bg-[var(--c-fill)]">
              <div className="flex items-center justify-between gap-2">
                <span>App webhook URL (set once by the platform):</span>
                {cfg?.webhook_url && <button onClick={copyUrl} className="inline-flex items-center gap-1 text-[var(--c-gold-deep)] hover:underline shrink-0">{copied ? 'Copied' : <><Copy size={11} /> Copy</>}</button>}
              </div>
              <code className="block mt-1 text-[var(--c-text)] break-all">{cfg?.webhook_url || '— set NEXT_PUBLIC_APP_URL —'}</code>
              <div className="flex items-center gap-3 mt-2">
                <Status ok={!!cfg?.verify_token_configured} label="FACEBOOK_VERIFY_TOKEN" />
                <Status ok={!!cfg?.app_secret_configured} label="FACEBOOK_APP_SECRET" />
                <Status ok={!!cfg?.oauth_available} label="FACEBOOK_APP_ID" />
              </div>
            </div>
          </details>
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
