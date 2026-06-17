import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/Badge';
import { UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { TeamProcessorsTab } from '@/components/team/TeamProcessorsTab';
import { TeamChatClient } from '../team-chat/TeamChatClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Team' };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  branch_manager: 'Branch Manager',
  loan_officer: 'Loan Officer',
  processor: 'Processor',
};

const ROLE_BADGE_VARIANT: Record<string, 'info' | 'gold' | 'neutral' | 'warning'> = {
  admin: 'gold',
  branch_manager: 'info',
  loan_officer: 'neutral',
  processor: 'warning',
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  // getOrgContext().orgId is already organizations.id (the uuid every org_id column
  // uses) — look it up by primary key, not clerk_org_id (which left the roster empty).
  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle();

  const { data: currentProfile } = await sb
    .from('profiles')
    .select('role, id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const canManage =
    currentProfile?.role === 'admin' ||
    currentProfile?.role === 'branch_manager' ||
    role === 'admin' ||
    role === 'branch_manager';

  // Chat is the default first tab and is open to every member. The Members /
  // Processors management tabs are admin/branch-manager only.
  let activeTab = searchParams.tab ?? 'chat';
  if (!canManage && (activeTab === 'members' || activeTab === 'processors')) activeTab = 'chat';

  // Management data is only needed (and only loaded) for managers.
  let members: Array<{ id: string; clerk_user_id: string; first_name: string | null; last_name: string | null; email: string | null; role: string; nmls_id: string | null; active: boolean; created_at: string }> = [];
  let processorAssignments: Array<{ id: string; processor_clerk_id: string; status: string; permissions: unknown; created_at: string; accepted_at: string | null }> = [];
  const filesByProcessor: Record<string, number> = {};

  if (canManage) {
    const [{ data: memberRows }, { data: assignmentRows }] = await Promise.all([
      sb
        .from('profiles')
        .select('id, clerk_user_id, first_name, last_name, email, role, nmls_id, active, created_at')
        .eq('org_id', org?.id ?? '')
        .order('created_at', { ascending: true }),
      sb
        .from('processor_assignments')
        .select('id, processor_clerk_id, status, permissions, created_at, accepted_at')
        .eq('org_id', org?.id ?? '')
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false }),
    ]);
    members = (memberRows ?? []) as typeof members;
    processorAssignments = (assignmentRows ?? []) as typeof processorAssignments;

    const processorIds = processorAssignments.map((a) => a.processor_clerk_id);
    if (processorIds.length > 0) {
      const { data: pfas } = await sb
        .from('processor_file_assignments')
        .select('processor_clerk_id, lead_id')
        .eq('org_id', org?.id ?? '')
        .in('processor_clerk_id', processorIds)
        .eq('active', true);
      for (const pfa of pfas ?? []) {
        filesByProcessor[pfa.processor_clerk_id] = (filesByProcessor[pfa.processor_clerk_id] ?? 0) + 1;
      }
    }
  }

  return (
    <div className={`${activeTab === 'chat' ? 'max-w-6xl' : 'max-w-3xl'} space-y-6`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Team</h1>
          <p className="text-label-2 text-sm mt-0.5">
            {canManage
              ? `${members.length} members · ${processorAssignments.filter((a) => a.status === 'active').length} processors`
              : 'Chat with your team — compliance-archived.'}
          </p>
        </div>
        {canManage && (
          <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors shadow-sm">
            <UserPlus size={14} />
            Invite Member
          </button>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="border-b border-border flex gap-0">
        {(canManage ? ['chat', 'members', 'processors'] : ['chat']).map((tab) => (
          <a
            key={tab}
            href={`/team?tab=${tab}`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 capitalize ${
              activeTab === tab
                ? 'border-blue text-blue'
                : 'border-transparent text-label-2 hover:text-black'
            }`}
          >
            {tab === 'chat' ? 'Chat' : tab === 'members' ? 'Members' : 'Processors'}
            {tab === 'processors' && processorAssignments.length > 0 && (
              <span className="ml-1.5 bg-blue/10 text-blue text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {processorAssignments.length}
              </span>
            )}
          </a>
        ))}
      </div>

      {activeTab === 'chat' ? (
        <TeamChatClient role={role} />
      ) : activeTab === 'members' ? (
        <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {(members ?? []).map((member) => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[12px] font-semibold text-blue">
                    {member.first_name?.[0]}{member.last_name?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black">
                    {member.first_name} {member.last_name}
                    {member.clerk_user_id === userId && (
                      <span className="text-xs text-label-3 ml-1.5">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-label-2">{member.email}</p>
                  {member.nmls_id && (
                    <p className="text-[11px] text-label-3 mt-0.5">NMLS #{member.nmls_id}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={ROLE_BADGE_VARIANT[member.role] ?? 'neutral'}
                    size="sm"
                  >
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                  {!member.active && (
                    <Badge variant="danger" size="sm">Inactive</Badge>
                  )}
                </div>
                <span className="text-[11px] text-label-3 hidden sm:block">
                  Joined {format(new Date(member.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <TeamProcessorsTab
          assignments={(processorAssignments ?? []) as Parameters<typeof TeamProcessorsTab>[0]['assignments']}
          filesByProcessor={filesByProcessor}
          orgId={org?.id ?? ''}
        />
      )}
    </div>
  );
}