import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { VideoMessagesClient } from './VideoMessagesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Video Messages' };

export default async function VideoMessagesPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const [{ data: videos }, { data: leads }] = await Promise.all([
    sb
      .from('video_messages')
      .select('*')
      .eq('org_id', org?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('leads')
      .select('id, first_name, last_name, email, phone, stage, sms_consent')
      .eq('org_id', org?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return (
    <VideoMessagesClient
      videos={videos ?? []}
      leads={leads ?? []}
      profileId={profile?.id ?? ''}
    />
  );
}