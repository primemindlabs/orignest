import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OrganizationForm } from './OrganizationForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Organization' };

export default async function OrganizationSettingsPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: org } = await sb
    .from('organizations')
    .select('id, name, nmls_company_id, licensed_states, billing_email')
    .eq('id', orgId)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Settings
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">Organization</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Company name, NMLS ID, and the states you&apos;re licensed to originate in.
        </p>
      </div>

      <OrganizationForm
        initial={{
          name: org?.name ?? '',
          nmls_company_id: org?.nmls_company_id ?? '',
          billing_email: org?.billing_email ?? '',
          licensed_states: (org?.licensed_states as string[] | null) ?? [],
        }}
        canEdit={role === 'admin'}
      />
    </div>
  );
}
