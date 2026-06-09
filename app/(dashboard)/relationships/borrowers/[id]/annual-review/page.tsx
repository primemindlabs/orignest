import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { AnnualReviewManager } from './AnnualReviewManager';

export const dynamic = 'force-dynamic';

export default async function AnnualReviewPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: rel } = await sb.from('borrower_relationships').select('id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!rel) notFound();
  const { data: reviews } = await sb.from('annual_reviews').select('id, review_year, status, ai_narrative, total_equity').eq('relationship_id', params.id).eq('org_id', orgId).order('review_year', { ascending: false });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Annual Review</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">A personal homeownership-anniversary review to send your client. Edit the message, preview, then send.</p>
      </div>
      <AnnualReviewManager recordId={params.id} initial={(reviews ?? []) as any} />
    </div>
  );
}
