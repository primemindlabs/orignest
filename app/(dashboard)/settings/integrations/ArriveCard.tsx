'use client';

/**
 * Phase 94 — Arrive (arrive.app) relocation-concierge connect card.
 *
 * Per-LO self-service (NOT admin-gated): each LO connects their own Arrive
 * partner account. Unlike the LOS cards, this is an INBOUND webhook flow — we
 * mint a webhook URL + secret for the LO to paste into their Arrive dashboard.
 * The secret is shown ONCE on connect/regenerate and never re-fetched.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Home, Check, X, Copy, RefreshCw } from 'lucide-react';

interface Status {
  connected: boolean;
  integration: { arrive_partner_id: string; is_active: boolean; created_at: string } | null;
  webhook_url: string | null;
  imported_count: number;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label3)] mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-[12px] bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[8px] px-2.5 py-1.5 text-[var(--c-text)]">{value}</code>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--c-label2)] hover:text-[var(--c-text)] px-2 py-1.5"
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

export function ArriveCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null); // shown once after connect/regenerate

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/arrive');
    if (res.ok) setStatus(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function connect(regenerate = false) {
    setBusy(true);
    try {
      const res = await fetch('/api/settings/arrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arrive_partner_id: partnerId.trim() || status?.integration?.arrive_partner_id, regenerate }),
      });
      if (res.ok) {
        const data = await res.json();
        setSecret(data.webhook_secret ?? null);
        setOpen(false);
        setPartnerId('');
        await load();
      }
    } finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try { await fetch('/api/settings/arrive', { method: 'DELETE' }); setSecret(null); await load(); } finally { setBusy(false); }
  }

  const connected = !!status?.connected;

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0"><Home size={17} className="text-[var(--c-label2)]" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-[var(--c-text)]">Arrive</p>
            {connected && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] inline-flex items-center gap-1"><Check size={10} /> Connected</span>}
          </div>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Relocation-concierge referrals flow in as new pre-qual leads with an automatic welcome email.</p>
          {connected && <p className="text-[11px] text-[var(--c-label3)] mt-1">{status!.imported_count} {status!.imported_count === 1 ? 'lead' : 'leads'} imported · Partner ID {status!.integration?.arrive_partner_id}</p>}
        </div>
        {connected ? (
          <Button variant="secondary" onClick={disconnect} disabled={busy}><X size={13} /> Disconnect</Button>
        ) : (
          <Button variant="secondary" onClick={() => { setOpen(!open); setSecret(null); }}>{open ? 'Cancel' : 'Connect'}</Button>
        )}
      </div>

      {/* Connect form (not yet connected) */}
      {open && !connected && (
        <div className="mt-3 pt-3 border-t border-[var(--c-border)] space-y-3">
          <Input label="Arrive Partner ID" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="Your ID inside Arrive" hint="Find this in your Arrive partner dashboard." />
          <Button onClick={() => connect(false)} disabled={busy || !partnerId.trim()}>{busy ? 'Connecting…' : 'Connect Arrive'}</Button>
        </div>
      )}

      {/* Webhook config — secret shown ONCE right after connect/regenerate */}
      {secret && status?.webhook_url && (
        <div className="mt-3 pt-3 border-t border-[var(--c-border)] space-y-3">
          <p className="text-[12px] text-[var(--c-text)] font-medium">Paste these into your Arrive webhook settings:</p>
          <CopyRow label="Webhook URL" value={status.webhook_url} />
          <CopyRow label="Signing Secret" value={secret} />
          <p className="text-[11px] text-[var(--c-gold-deep)]">⚠ This secret is shown only once. Save it now — regenerate below if you lose it.</p>
        </div>
      )}

      {/* Connected, secret not currently shown — let them re-reveal URL + rotate secret */}
      {connected && !secret && status?.webhook_url && (
        <div className="mt-3 pt-3 border-t border-[var(--c-border)] space-y-3">
          <CopyRow label="Webhook URL" value={status.webhook_url} />
          <button type="button" onClick={() => connect(true)} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-label2)] hover:text-[var(--c-text)] disabled:opacity-50">
            <RefreshCw size={12} /> Regenerate signing secret
          </button>
        </div>
      )}
    </div>
  );
}
