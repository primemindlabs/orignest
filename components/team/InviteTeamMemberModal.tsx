'use client';

/**
 * Phase 133 — invite a team member with a role. When the role is LOA, the admin
 * must pick which loan officer the assistant will support. Returns a shareable
 * invite link (email is best-effort server-side).
 */
import { useState } from 'react';
import { X, UserPlus, Copy, Check } from 'lucide-react';

const GOLD = '#C9A95C';
const ROLE_OPTS = [
  { v: 'lo', l: 'Loan Officer' },
  { v: 'loa', l: 'LO Assistant' },
  { v: 'processor', l: 'Loan Processor' },
  { v: 'branch_manager', l: 'Branch Manager' },
];

export function InviteTeamMemberModal({
  los,
  onClose,
  onInvited,
}: {
  los: { id: string; name: string }[];
  onClose: () => void;
  onInvited: (email: string, role: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('lo');
  const [assignedLo, setAssignedLo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const field = 'w-full h-9 px-3 rounded-[10px] text-sm bg-white border border-[var(--c-border)] text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[#C9A95C]';

  async function submit() {
    if (!email.trim()) { setErr('Email is required.'); return; }
    if (role === 'loa' && !assignedLo) { setErr('Select the loan officer this assistant supports.'); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, assigned_lo_id: role === 'loa' ? assignedLo : null }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Failed to send invite.'); return; }
      setLink(d.invite_url ?? null);
      onInvited(email.trim(), role);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold text-[var(--c-text)] flex items-center gap-2"><UserPlus size={18} style={{ color: GOLD }} /> Invite team member</p>
          <button onClick={onClose} className="text-[var(--c-label2)] hover:text-[var(--c-text)]"><X size={18} /></button>
        </div>

        {link ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--c-text)]">Invite created. Share this link (it also went out by email if email is configured):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[12px] bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[8px] px-2.5 py-1.5">{link}</code>
              <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)] px-2 py-1.5">
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
            <button onClick={onClose} className="h-9 px-4 rounded-[10px] text-sm font-medium text-white w-full" style={{ background: GOLD }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Email</label>
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Role</label>
              <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            {role === 'loa' && (
              <div>
                <label className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Assists which loan officer?</label>
                <select className={field} value={assignedLo} onChange={(e) => setAssignedLo(e.target.value)}>
                  <option value="">Select a loan officer…</option>
                  {los.map((lo) => <option key={lo.id} value={lo.id}>{lo.name}</option>)}
                </select>
              </div>
            )}
            {err && <p className="text-[12px] text-red-600">{err}</p>}
            <button onClick={submit} disabled={busy} className="h-9 px-4 rounded-[10px] text-sm font-medium text-white w-full disabled:opacity-50" style={{ background: GOLD }}>
              {busy ? 'Sending…' : 'Send invite'}
            </button>
            <p className="text-[11px] text-[var(--c-label2)]">LOA and Processor are Team-plan seats. Seat billing is configured separately.</p>
          </div>
        )}
      </div>
    </div>
  );
}
