import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Library } from 'lucide-react';
import { AdLibraryClient, type Creative } from './AdLibraryClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Creative Library — AshleyIQ' };

export default async function AdLibraryPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data }, { data: org }, { data: profile }] = await Promise.all([
    sb
      .from('ad_creatives')
      .select('id, ad_type, platform, headline, primary_text, description, cta_type, nmls_number, apr_disclosure, created_at')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(200),
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    sb.from('profiles').select('nmls_id').eq('clerk_user_id', userId).maybeSingle(),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <Link href="/ads" className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors">
          <ArrowLeft size={14} /> Ad Center
        </Link>
        <div className="flex items-center gap-2.5 mt-2">
          <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/15 flex items-center justify-center">
            <Library size={18} className="text-[#C9A95C]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-black tracking-tight">Creative Library</h1>
            <p className="text-[13px] text-label-2">Ready-to-use ad templates plus every creative you save — preview, reuse, and adapt.</p>
          </div>
        </div>
      </div>

      <AdLibraryClient
        initial={(data ?? []) as Creative[]}
        companyName={org?.name ?? 'Your Company'}
        nmls={(profile?.nmls_id as string | null) ?? null}
      />
    </div>
  );
}
