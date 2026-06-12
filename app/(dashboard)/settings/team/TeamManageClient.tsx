'use client';

/** Phase 133 — team management: members + roles + invite (replaces the simple
 * invite-only client). Admins can assign roles inline and invite new members. */
import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { TeamMemberRow, type TeamMember } from '@/components/team/TeamMemberRow';
import { InviteTeamMemberModal } from '@/components/team/InviteTeamMemberModal';
import { ROLE_LABELS, normalizeRole } from '@/lib/navigation/roles';

const GOLD = '#C9A95C';
interface Invite { id: string; email: string; role: string; expires_at: string }

export function TeamManageClient({
  members,
  los,
  initialInvites,
  canManage,
  atLimit,
}: {
  members: TeamMember[];
  los: { id: string; name: string }[];
  initialInvites: Invite[];
  canManage: boolean;
  atLimit: boolean;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);

  async function revoke(id: string) {
    setInvites((i) => i.filter((x) => x.id !== id));
    if (!id.startsWith('new-')) await fetch(`/api/team/invite/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowInvite(true)}
            disabled={atLimit}
            title={atLimit ? 'Seat limit reached — upgrade your plan' : undefined}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: GOLD }}
          >
            <UserPlus size={15} /> Invite team member
          </button>
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] px-4 py-2.5 border-b border-[var(--c-border)]">Pending invites</p>
          <div className="divide-y divide-[var(--c-border)]">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-[13px] text-[var(--c-text)]">{inv.email}</p>
                  <p className="text-[11px] text-[var(--c-label2)]">{ROLE_LABELS[normalizeRole(inv.role)]} · invited</p>
                </div>
                {canManage && <button onClick={() => revoke(inv.id)} className="text-[var(--c-label2)] hover:text-red-600"><X size={15} /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] px-4 py-2.5 border-b border-[var(--c-border)]">Members ({members.length})</p>
        <div className="divide-y divide-[var(--c-border)]">
          {members.map((m) => <TeamMemberRow key={m.id} member={m} los={los} canManage={canManage} />)}
        </div>
      </div>

      {showInvite && (
        <InviteTeamMemberModal
          los={los}
          onClose={() => setShowInvite(false)}
          onInvited={(email, role) => setInvites((i) => [{ id: 'new-' + Date.now(), email, role, expires_at: '' }, ...i])}
        />
      )}
    </div>
  );
}
