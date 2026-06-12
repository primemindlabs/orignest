import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PLANS } from '@/lib/stripe/plans';
import { normalizeRole } from '@/lib/navigation/roles';
import { TeamManageClient } from './TeamManageClient';
import type { TeamMember } from '@/components/team/TeamMemberRow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Team' };

export default async function SettingsTeamPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: members }, { data: roles }, { data: invites }, { data: org }, { data: meRow }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, email, role, nmls_id').eq('org_id', orgId).order('first_name'),
    sb.from('user_roles').select('user_id, role, assigned_lo_id').eq('org_id', orgId).eq('is_active', true),
    sb.from('invitations').select('id, email, role, expires_at').eq('org_id', orgId).is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }),
    sb.from('organizations').select('subscription_plan').eq('id', orgId).maybeSingle(),
    sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle(),
  ]);

  const nameOf = (m: { first_name?: string | null; last_name?: string | null; email?: string | null }) =>
    `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || (m.email ?? 'Member');

  // user_roles override the legacy profiles.role.
  const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r]));
  const memberList = members ?? [];
  const nameById = new Map(memberList.map((m) => [m.id, nameOf(m)]));

  const teamMembers: TeamMember[] = memberList.map((m) => {
    const ur = roleMap.get(m.id);
    const effectiveRole = ur?.role ?? m.role ?? 'lo';
    const assignedLoId = (ur?.assigned_lo_id as string | null) ?? null;
    return {
      id: m.id,
      name: nameOf(m),
      email: m.email ?? '',
      role: effectiveRole,
      assignedLoId,
      assignedLoName: assignedLoId ? nameById.get(assignedLoId) ?? null : null,
      isSelf: m.id === meRow?.id,
    };
  });

  // Loan officers (incl. branch managers / admins who own pipelines) — the
  // candidates an LOA can be assigned to.
  const los = teamMembers
    .filter((m) => ['lo', 'branch_manager', 'admin'].includes(normalizeRole(m.role)))
    .map((m) => ({ id: m.id, name: m.name }));

  const seatLimit = PLANS[(org?.subscription_plan ?? 'starter') as keyof typeof PLANS]?.seats ?? 1;
  const seatsUsed = memberList.length;
  const canManage = role === 'admin' || role === 'branch_manager';
  const atLimit = seatLimit > 0 && seatsUsed + (invites ?? []).length >= seatLimit;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Settings</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Team</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          {seatsUsed} of {seatLimit < 0 ? 'unlimited' : seatLimit} seats used. Assign roles to scope what each member can see and do.
        </p>
      </div>

      <TeamManageClient
        members={teamMembers}
        los={los}
        initialInvites={invites ?? []}
        canManage={canManage}
        atLimit={atLimit}
      />
    </div>
  );
}
