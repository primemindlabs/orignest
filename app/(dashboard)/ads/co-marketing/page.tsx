import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CoMarketingClient } from './CoMarketingClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Co-Marketing' };

export default async function CoMarketingPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { data: partners } = await createAdminClient()
    .from('referral_partners')
    .select('id, company_name, first_name, last_name')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('company_name');

  const options = (partners ?? []).map((p) => {
    const personName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    return { id: p.id, label: personName || p.company_name || 'Partner' };
  });

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <Link href="/ads" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Ad Center
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Co-Marketing</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Build a co-branded ad with a realtor partner. The budget split must keep you RESPA-compliant.
        </p>
      </div>
      <CoMarketingClient partners={options} />
    </div>
  );
}
