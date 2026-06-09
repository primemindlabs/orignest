'use client';

/** Phase 36.4 — team invite form + pending invitations. */
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Copy, Check, X, UserPlus } from 'lucide-react';

interface Invite { id: string; email: string; role: string; expires_at: string }

const ROLE_OPTIONS = [
  { value: 'loan_officer', label: 'Loan Officer' },
  { value: 'processor', label: 'Loan Processor' },
  { value: 'branch_manager', label: 'Branch Manager' },
];

export function TeamInviteClient({ initialInvites, seatsUsed, seatLimit, canInvite }: { initialInvites: Invite[]; seatsUsed: number; seatLimit: number; canInvite: boolean }) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('loan_officer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const atLimit = seatLimit > 0 && seatsUsed + invites.length >= seatLimit;

  async function invite() {
    if (!email.trim()) return;
    setBusy(true); setErr(null); setLink(null);
    try {
      const res = await fetch('/api/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Failed to invite'); return; }
      setLink(d.invite_url ?? null);
      setInvites((i) => [{ id: 'new-' + Date.now(), email: d.email, role, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }, ...i]);
      setEmail('');
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setInvites((i) => i.filter((x) => x.id !== id));
    if (!id.startsWith('new-')) await fetch(`/api/team/invite/${id}`, { method: 'DELETE' });
  }

  if (!canInvite) {
    return <p className="text-[13px] text-[var(--c-label2)]">Only admins and branch managers can invite team members.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[13px] font-semibold text-[var(--c-text)] mb-3">Invite a team member</p>
        {atLimit ? (
          <div className="text-[12px] text-[var(--c-text)] bg-[var(--c-gold-light)] rounded-[10px] px-3 py-2">
            You&apos;ve reached your seat limit ({seatLimit}). <Link href="/settings/billing" className="text-[var(--c-gold-deep)] underline">Upgrade your plan</Link> to add more.
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1"><Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lo@company.com" /></div>
            <div className="w-44"><Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_OPTIONS} /></div>
            <Button onClick={invite} disabled={busy || !email.trim()}><UserPlus size={14} /> {busy ? 'Sending…' : 'Invite'}</Button>
          </div>
        )}
        {err && <p className="text-[12px] text-[var(--c-danger)] mt-2">{err}</p>}
        {link && (
          <div className="mt-3 text-[12px] text-[var(--c-label2)]">
            Invitation created. Share this link (expires in 7 days):
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-[11px] bg-[var(--c-fill)] rounded px-2 py-1 truncate">{link}</code>
              <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-[var(--c-gold-deep)]">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </div>
          </div>
        )}
      </div>

      {invites.length > 0 && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] px-4 py-2.5 border-b border-[var(--c-border)]">Pending invitations</p>
          <div className="divide-y divide-[var(--c-border)]">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                <div><p className="text-[13px] text-[var(--c-text)]">{inv.email}</p><p className="text-[11px] text-[var(--c-label2)]">{inv.role.replace(/_/g, ' ')}</p></div>
                <button onClick={() => revoke(inv.id)} className="text-[12px] text-[var(--c-label2)] hover:text-[var(--c-danger)] inline-flex items-center gap-1"><X size={12} /> Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
