// Phase 105 — LO-side: mint (or reuse) a digital 1003 for this loan and surface the
// shareable borrower link. Authenticated + org-scoped; the form itself is public.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Apply1003Share } from '@/components/apply/Apply1003Share';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Digital 1003' };

export default async function Apply1003Page({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name')
    .eq('id', loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) redirect('/pipeline');

  // Reuse the latest non-submitted application, or mint a new one.
  let { data: app } = await sb
    .from('applications')
    .select('id, token, status')
    .eq('lead_id', loanId)
    .eq('org_id', orgId)
    .neq('status', 'submitted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) {
    const seed = {
      borrower_first_name: lead.first_name ?? null,
      borrower_last_name: lead.last_name ?? null,
    };
    const { data: created } = await sb
      .from('applications')
      .insert({ org_id: orgId, lead_id: loanId, ...seed })
      .select('id, token, status')
      .single();
    app = created;
  }

  const borrowerName = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'this borrower';

  return (
    <div className="max-w-xl">
      <Apply1003Share token={app!.token as string} borrowerName={borrowerName} status={app!.status as string} />
    </div>
  );
}
