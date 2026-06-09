'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Plus, UserCheck, Link2, Ban, Clock } from 'lucide-react';

export interface RealtorRow {
  id: string;
  realtor_name: string;
  realtor_email: string;
  realtor_phone: string | null;
  permission_tier: string;
  added_by: string;
  approved_by_lo: boolean;
  revoked: boolean;
  token: string;
}

const TIER_OPTIONS = [
  { value: 'status_only', label: 'Status Only' },
  { value: 'transaction_partner', label: 'Transaction Partner' },
  { value: 'full_partner', label: 'Full Partner' },
];
const TIER_LABEL: Record<string, string> = { status_only: 'Status Only', transaction_partner: 'Transaction Partner', full_partner: 'Full Partner' };

export function RealtorAccessManager({ loanId, initial }: { loanId: string; initial: RealtorRow[] }) {
  const [realtors, setRealtors] = useState<RealtorRow[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ realtor_name: '', realtor_email: '', realtor_phone: '', permission_tier: 'status_only' });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!draft.realtor_name.trim() || !draft.realtor_email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/realtors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const json = await res.json();
      if (res.ok) { setRealtors((r) => [json.realtor, ...r]); setDraft({ realtor_name: '', realtor_email: '', realtor_phone: '', permission_tier: 'status_only' }); setAdding(false); }
    } finally { setBusy(false); }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/realtors`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...payload }) });
      if (res.ok) {
        const json = await res.json();
        setRealtors((cur) => cur.map((r) => (r.id === id ? { ...r, ...json.realtor } : r)));
      }
    } finally { setBusy(false); }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/portal/realtor/${token}`;
    void navigator.clipboard?.writeText(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Realtor access</h2>
        {!adding && <Button size="sm" variant="outline" leftIcon={<Plus size={14} />} onClick={() => setAdding(true)}>Add realtor</Button>}
      </div>

      {adding && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-gold)]/40 rounded-[14px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={draft.realtor_name} onChange={(e) => setDraft((d) => ({ ...d, realtor_name: e.target.value }))} />
            <Input label="Email" type="email" value={draft.realtor_email} onChange={(e) => setDraft((d) => ({ ...d, realtor_email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={draft.realtor_phone} onChange={(e) => setDraft((d) => ({ ...d, realtor_phone: e.target.value }))} />
            <Select label="Access level" options={TIER_OPTIONS} value={draft.permission_tier} onChange={(e) => setDraft((d) => ({ ...d, permission_tier: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={add} loading={busy}>Add &amp; invite</Button>
          </div>
        </div>
      )}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
        {realtors.length === 0 && <p className="text-[13px] text-[var(--c-label3)] text-center py-8">No realtors linked to this loan.</p>}
        {realtors.map((r) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--c-text)]">{r.realtor_name}</p>
                <p className="text-[11px] text-[var(--c-label2)]">{r.realtor_email}{r.realtor_phone ? ` · ${r.realtor_phone}` : ''}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {r.revoked ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-[var(--c-danger)] bg-[var(--c-fill)]">Revoked</span>
                  ) : r.approved_by_lo ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-[var(--c-success)] bg-[var(--c-fill)]">{TIER_LABEL[r.permission_tier]}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-[var(--c-warning)] bg-[var(--c-fill)]"><Clock size={9} /> Awaiting your approval</span>
                  )}
                  {r.added_by === 'borrower' && <span className="text-[10px] text-[var(--c-label3)]">added by borrower</span>}
                </div>
              </div>
              {!r.revoked && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.approved_by_lo && (
                    <button onClick={() => copyLink(r.token)} className="inline-flex items-center gap-1 text-[11px] text-[var(--c-gold-deep)] hover:opacity-80" title="Copy portal link"><Link2 size={12} /> Link</button>
                  )}
                  <button onClick={() => patch(r.id, { revoke: true })} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-[var(--c-label2)] hover:text-[var(--c-danger)]"><Ban size={12} /> Revoke</button>
                </div>
              )}
            </div>

            {/* Approve / change tier */}
            {!r.revoked && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-[var(--c-label3)]">{r.approved_by_lo ? 'Change access:' : 'Approve with access:'}</span>
                {TIER_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => patch(r.id, { permission_tier: t.value })}
                    disabled={busy}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      r.permission_tier === t.value && r.approved_by_lo ? 'border-[var(--c-gold)] text-[var(--c-gold-deep)] bg-[var(--c-gold-light)]' : 'border-[var(--c-border)] text-[var(--c-label2)] hover:bg-[var(--c-fill)]'
                    }`}
                  >
                    {!r.approved_by_lo && <UserCheck size={10} />} {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--c-label3)]">Realtors never see financial data (DTI, income, credit, rate) regardless of access level.</p>
    </div>
  );
}
