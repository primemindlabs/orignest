import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { CoMarketingGenerator } from '@/components/tools/CoMarketingGenerator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Co-Marketing Generator' };

export default async function CoMarketingGeneratePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: realtors } = await sb
    .from('realtors')
    .select('id, first_name, last_name, brokerage_name')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('first_name', { ascending: true })
    .limit(200);

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Co-Marketing Generator</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          AI-generated, compliance-safe copy for flyers, guides, and social posts — co-branded with your realtor partners.
        </p>
      </div>
      <CoMarketingGenerator realtors={realtors ?? []} />
    </div>
  );
}
