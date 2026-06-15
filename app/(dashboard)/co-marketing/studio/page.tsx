import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { CanvaEditor, type StudioLO, type StudioPartner } from '@/components/design/CanvaEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Design Studio — Co-Marketing' };

export default async function CoMarketingStudioPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: profile }, { data: partners }] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, nmls_id, phone').eq('clerk_user_id', userId).eq('org_id', orgId).maybeSingle(),
    sb.from('referral_partners').select('id, first_name, last_name, company_name').eq('active', true).order('first_name'),
  ]);

  const lo: StudioLO = {
    name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your Name',
    nmls: profile?.nmls_id ?? null,
    phone: profile?.phone ?? null,
  };
  const studioPartners: StudioPartner[] = (partners ?? []).map((p) => ({
    id: p.id as string,
    name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.company_name as string) || 'Partner',
    company: (p.company_name as string) ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <Link href="/co-marketing" className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors">
          <ArrowLeft size={14} /> Co-Marketing
        </Link>
        <div className="flex items-center gap-2.5 mt-2">
          <div className="w-9 h-9 rounded-xl bg-[#34C759]/15 flex items-center justify-center">
            <Wand2 size={18} className="text-[#34C759]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-black tracking-tight">Design Studio</h1>
            <p className="text-[13px] text-label-2">Pick a template, edit it live, co-brand with a partner, and export.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-5">
        <CanvaEditor surface="co_marketing" lo={lo} partners={studioPartners} />
      </div>
    </div>
  );
}
