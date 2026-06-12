import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { IconFolder, IconChecklist } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Files' };

const STAGE_LABELS: Record<string, string> = {
  processing: 'Processing', underwriting: 'Underwriting', conditional_approval: 'Conditional Approval',
  clear_to_close: 'Clear to Close', application: 'Application',
};

export default async function ProcessorHomePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: me } = await sb.from('profiles').select('id, first_name').eq('clerk_user_id', userId).maybeSingle();

  // App-layer scoping (RLS is inert with Clerk): only loans assigned to me.
  const { data: assignments } = await sb
    .from('loan_processor_assignments')
    .select('loan_id')
    .eq('processor_id', me?.id ?? '')
    .eq('org_id', orgId)
    .eq('is_active', true);
  const leadIds = (assignments ?? []).map((a) => a.loan_id as string);

  const [{ data: leads }, { data: conds }] = await Promise.all([
    leadIds.length
      ? sb.from('leads').select('id, first_name, last_name, stage, loan_type').eq('org_id', orgId).in('id', leadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    leadIds.length
      ? sb.from('loan_conditions').select('lead_id, status').eq('org_id', orgId).in('lead_id', leadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const condCount = new Map<string, { outstanding: number; total: number }>();
  for (const c of conds ?? []) {
    const k = c.lead_id as string;
    const cur = condCount.get(k) ?? { outstanding: 0, total: 0 };
    cur.total += 1;
    if (c.status !== 'cleared') cur.outstanding += 1;
    condCount.set(k, cur);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">My Files</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          {leadIds.length} loan{leadIds.length === 1 ? '' : 's'} assigned to you{me?.first_name ? `, ${me.first_name}` : ''}. You see conditions and documents for these files only.
        </p>
      </div>

      {(leads ?? []).length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-12 text-center">
          <IconFolder size={26} className="mx-auto text-[var(--c-label3)]" />
          <p className="text-[14px] font-medium text-[var(--c-text)] mt-2">No files assigned yet</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-1">A loan officer or branch manager assigns loans to you. Assigned files appear here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {(leads ?? []).map((l) => {
            const cc = condCount.get(l.id as string) ?? { outstanding: 0, total: 0 };
            return (
              <Link key={l.id as string} href={`/leads/${l.id}?tab=conditions`} className="block bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 hover:border-[#C9A95C] transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--c-text)]">{l.first_name as string} {l.last_name as string}</p>
                    <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{STAGE_LABELS[l.stage as string] ?? (l.stage as string)}{l.loan_type ? ` · ${l.loan_type}` : ''}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] flex-shrink-0">
                    <IconChecklist size={14} />
                    {cc.total === 0 ? 'No conditions' : cc.outstanding === 0 ? 'All satisfied ✓' : `${cc.outstanding} outstanding`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
