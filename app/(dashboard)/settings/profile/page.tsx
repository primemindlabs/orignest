import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProfileSettings, type ProfileData } from '@/components/settings/ProfileSettings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profile' };

export default async function ProfileSettingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('first_name, last_name, nmls_id, phone, title, email, avatar_url, comp_rate, monthly_volume_goal')
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();

  const data: ProfileData = {
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    nmls_id: profile?.nmls_id ?? null,
    phone: profile?.phone ?? null,
    title: profile?.title ?? null,
    email: profile?.email ?? null,
    avatar_url: profile?.avatar_url ?? null,
    comp_rate: profile?.comp_rate ?? null,
    monthly_volume_goal: profile?.monthly_volume_goal ?? null,
  };

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
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">Profile</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Your name, NMLS #, photo, and the goal &amp; commission rate that drive your dashboard.
        </p>
      </div>

      <ProfileSettings profile={data} company={org?.name ?? null} />
    </div>
  );
}
