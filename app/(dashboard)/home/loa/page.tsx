import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getRoleForUser } from '@/lib/roles/getRoleForUser';
import { LoaDraftComposer } from '@/components/team/LoaDraftComposer';
import { DraftsForReview } from '@/components/team/DraftsForReview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'LOA Workspace' };

export default async function LoaHomePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const resolved = await getRoleForUser(sb, userId, orgId);
  const assignedLoId = resolved.assignedLoId;

  if (!assignedLoId) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">LOA Workspace</h1>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-10 text-center mt-4">
          <p className="text-[14px] font-medium text-[var(--c-text)]">You&apos;re not assigned to a loan officer yet</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-1">An admin assigns you to an LO under Settings → Team. Once assigned, that LO&apos;s pipeline appears here.</p>
        </div>
      </div>
    );
  }

  const { data: lo } = await sb.from('profiles').select('first_name, last_name').eq('id', assignedLoId).maybeSingle();
  const loName = `${lo?.first_name ?? ''} ${lo?.last_name ?? ''}`.trim() || 'your loan officer';

  // App-layer scoping: the assigned LO's pipeline.
  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, loan_type')
    .eq('org_id', orgId)
    .eq('assigned_to', assignedLoId)
    .not('stage', 'in', '(closed,declined,withdrawn)')
    .order('stage_changed_at', { ascending: true })
    .limit(100);
  const leadIds = (leads ?? []).map((l) => l.id as string);

  // Morning summary: conditions outstanding 5+ days on those files.
  const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const { count: agingConditions } = leadIds.length
    ? await sb.from('loan_conditions').select('id', { count: 'exact', head: true })
        .eq('org_id', orgId).in('lead_id', leadIds).neq('status', 'cleared').lte('created_at', fiveDaysAgo)
    : { count: 0 };

  const files = (leads ?? []).map((l) => ({ id: l.id as string, name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Borrower' }));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">LOA Workspace</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Assisting <span className="font-medium text-[var(--c-text)]">{loName}</span> · {files.length} active file{files.length === 1 ? '' : 's'}</p>
      </div>

      {/* Morning summary */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Morning summary</p>
        <ul className="text-[13px] text-[var(--c-text)] space-y-1">
          <li>• {agingConditions ?? 0} condition{(agingConditions ?? 0) === 1 ? '' : 's'} outstanding 5+ days — needs follow-up</li>
          <li>• {files.length} active file{files.length === 1 ? '' : 's'} in {loName}&apos;s pipeline</li>
        </ul>
      </div>

      {/* Draft a message */}
      <LoaDraftComposer files={files} />

      {/* My submitted drafts */}
      <div>
        <p className="text-[14px] font-semibold text-[var(--c-text)] mb-2">My drafts</p>
        <DraftsForReview />
      </div>

      {/* Assigned files */}
      <div>
        <p className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Assigned files</p>
        {files.length === 0 ? (
          <p className="text-[13px] text-[var(--c-label2)]">No active files right now.</p>
        ) : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
            {(leads ?? []).map((l) => (
              <Link key={l.id as string} href={`/leads/${l.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--c-fill)] transition-colors">
                <span className="text-[13px] text-[var(--c-text)]">{l.first_name as string} {l.last_name as string}</span>
                <span className="text-[11px] text-[var(--c-label2)]">{l.stage as string}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
