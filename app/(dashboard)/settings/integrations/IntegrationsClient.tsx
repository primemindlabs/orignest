'use client';

/** Phase 41.7 — LOS connect/disconnect cards (LendingPad + Arive). */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plug, Check, X, ChevronRight } from 'lucide-react';

interface Conn { los_type: string; is_active: boolean; last_sync_at: string | null; sync_error: string | null; webhook_secret?: string | null }

const LOS = [
  { id: 'lendingpad', name: 'LendingPad', desc: 'Sync loan status, conditions, and contacts with your LendingPad account.', fields: [{ key: 'api_key', label: 'API Key' }, { key: 'api_secret', label: 'API Secret' }] },
  { id: 'arive', name: 'Arive', desc: 'Sync loan pipeline and conditions with your Arive account.', fields: [{ key: 'api_key', label: 'API Key' }] },
  { id: 'byte', name: 'BytePro', desc: 'Receive loan status updates from BytePro via webhook (receive-only).', fields: [{ key: 'api_key', label: 'BytePro Account ID' }] },
];

export function IntegrationsClient({ canManage }: { canManage: boolean }) {
  const [conns, setConns] = useState<Conn[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/los');
    if (res.ok) setConns((await res.json()).connections ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const connOf = (id: string) => conns.find((c) => c.los_type === id && c.is_active);

  async function connect(id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/settings/los', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ los_type: id, ...form }) });
      if (res.ok) { setOpen(null); setForm({}); await load(); }
    } finally { setBusy(false); }
  }
  async function disconnect(id: string) {
    setBusy(true);
    try { await fetch(`/api/settings/los?los_type=${id}`, { method: 'DELETE' }); await load(); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {LOS.map((los) => {
        const c = connOf(los.id);
        const isOpen = open === los.id;
        return (
          <div key={los.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0"><Plug size={17} className="text-[var(--c-label2)]" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-[var(--c-text)]">{los.name}</p>
                  {c && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] inline-flex items-center gap-1"><Check size={10} /> Connected</span>}
                </div>
                <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{los.desc}</p>
                {c?.sync_error && <p className="text-[11px] text-[var(--c-label3)] mt-1">{c.sync_error}</p>}
                {c && los.id === 'byte' && (
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    <p className="text-[var(--c-label2)]">Point BytePro&apos;s webhook here (HMAC-SHA256, header <code>x-webhook-signature</code>):</p>
                    <code className="block bg-[var(--c-fill)] rounded px-2 py-1 break-all text-[var(--c-text)]">{(typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/byte</code>
                    {c.webhook_secret && (
                      <>
                        <p className="text-[var(--c-label2)]">Signing secret:</p>
                        <code className="block bg-[var(--c-fill)] rounded px-2 py-1 break-all text-[var(--c-text)]">{c.webhook_secret}</code>
                      </>
                    )}
                  </div>
                )}
              </div>
              {canManage && (c ? (
                <Button variant="secondary" onClick={() => disconnect(los.id)} disabled={busy}><X size={13} /> Disconnect</Button>
              ) : (
                <Button variant="secondary" onClick={() => { setOpen(isOpen ? null : los.id); setForm({}); }}>{isOpen ? 'Cancel' : 'Connect'} <ChevronRight size={13} /></Button>
              ))}
            </div>

            {isOpen && !c && canManage && (
              <div className="mt-3 pt-3 border-t border-[var(--c-border)] space-y-3">
                {los.fields.map((f) => (
                  <Input key={f.key} label={f.label} type="password" value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} placeholder="••••••••" />
                ))}
                <Button onClick={() => connect(los.id)} disabled={busy || !form.api_key}>{busy ? 'Saving…' : 'Save & connect'}</Button>
                <p className="text-[11px] text-[var(--c-label2)]">Keys are encrypted (AES-256-GCM) at rest. Live bi-directional sync activates once the LOS API is reachable.</p>
              </div>
            )}
          </div>
        );
      })}
      {!canManage && <p className="text-[12px] text-[var(--c-label2)]">Only admins can manage LOS connections.</p>}
    </div>
  );
}
