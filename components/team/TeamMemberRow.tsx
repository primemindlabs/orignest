'use client';

/** Phase 133 — a team member row with an inline role editor (admin only). */
import { useState } from 'react';
import { ROLE_LABELS, normalizeRole } from '@/lib/navigation/roles';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedLoId: string | null;
  assignedLoName: string | null;
  isSelf: boolean;
}

const ROLE_OPTS = [
  { v: 'lo', l: 'Loan Officer' },
  { v: 'loa', l: 'LO Assistant' },
  { v: 'processor', l: 'Loan Processor' },
  { v: 'branch_manager', l: 'Branch Manager' },
  { v: 'admin', l: 'Admin' },
];

export function TeamMemberRow({ member, los, canManage }: { member: TeamMember; los: { id: string; name: string }[]; canManage: boolean }) {
  const [role, setRole] = useState(normalizeRole(member.role));
  const [assignedLo, setAssignedLo] = useState(member.assignedLoId ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const field = 'h-8 px-2 rounded-[8px] text-[12px] bg-white border border-[var(--c-border)] text-[var(--c-text)]';

  async function save(nextRole: string, nextLo: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/team/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: member.id, role: nextRole, assigned_lo_id: nextRole === 'loa' ? nextLo : null }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Failed'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--c-text)] truncate">{member.name}{member.isSelf ? ' (you)' : ''}</p>
        <p className="text-[11px] text-[var(--c-label2)] truncate">{member.email}</p>
      </div>

      {canManage && !member.isSelf ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          {role === 'loa' && (
            <select
              className={field}
              value={assignedLo}
              onChange={(e) => { setAssignedLo(e.target.value); if (e.target.value) save('loa', e.target.value); }}
            >
              <option value="">Assign LO…</option>
              {los.map((lo) => <option key={lo.id} value={lo.id}>{lo.name}</option>)}
            </select>
          )}
          <select
            className={field}
            value={role}
            disabled={busy}
            onChange={(e) => { const r = e.target.value as typeof role; setRole(r); if (r !== 'loa') save(r, ''); }}
          >
            {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          {saved && <span className="text-[11px] text-green-600">Saved</span>}
          {err && <span className="text-[11px] text-red-600">{err}</span>}
        </div>
      ) : (
        <span className="text-[11px] text-[var(--c-label2)] flex-shrink-0">
          {ROLE_LABELS[normalizeRole(member.role)]}
          {member.assignedLoName ? ` · assists ${member.assignedLoName}` : ''}
        </span>
      )}
    </div>
  );
}
