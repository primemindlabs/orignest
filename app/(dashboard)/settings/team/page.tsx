import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PLANS } from '@/lib/stripe/plans';
import { TeamInviteClient } from './TeamInviteClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Team' };

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', branch_manager: 'Branch Manager', loan_officer: 'Loan Officer', processor: 'Processor', manager: 'Manager', lo: 'Loan Officer' };

export default async function SettingsTeamPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: members }, { data: invites }, { data: org }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, email, role, nmls_id').eq('org_id', orgId).order('first_name'),
    sb.from('invitations').select('id, email, role, expires_at').eq('org_id', orgId).is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }),
    sb.from('organizations').select('subscription_plan').eq('id', orgId).maybeSingle(),
  ]);

  const seatLimit = PLANS[(org?.subscription_plan ?? 'starter') as keyof typeof PLANS]?.seats ?? 1;
  const seatsUsed = (members ?? []).length;
  const canInvite = role === 'admin' || role === 'branch_manager';

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Settings</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Team</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{seatsUsed} of {seatLimit < 0 ? 'unlimited' : seatLimit} seats used.</p>
      </div>

      <TeamInviteClient initialInvites={invites ?? []} seatsUsed={seatsUsed} seatLimit={seatLimit} canInvite={canInvite} />

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] px-4 py-2.5 border-b border-[var(--c-border)]">Members</p>
        <div className="divide-y divide-[var(--c-border)]">
          {(members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-[13px] text-[var(--c-text)]">{`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email}</p>
                <p className="text-[11px] text-[var(--c-label2)]">{m.email}{m.nmls_id ? ` · NMLS #${m.nmls_id}` : ''}</p>
              </div>
              <span className="text-[11px] text-[var(--c-label2)]">{ROLE_LABELS[m.role] ?? m.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
