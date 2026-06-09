import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreativeBuilder } from './CreativeBuilder';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Compliant Ad Builder' };

export default async function AdBuilderPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { data: profile } = await createAdminClient().from('profiles').select('nmls_id').eq('clerk_user_id', userId).maybeSingle();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/ads" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Ad Center
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Compliant Ad Builder</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Generate compliant mortgage ad copy, run an AI compliance review, and export to Meta or Google — with NMLS#, Equal Housing, and program disclosures enforced.
        </p>
      </div>
      <CreativeBuilder nmls={profile?.nmls_id ?? null} />
    </div>
  );
}
