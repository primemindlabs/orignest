import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ensureReferralCode } from '@/lib/referrals/referralCodes';
import ApplyClient from './ApplyClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sb = createAdminClient();
  const { data: p } = await sb
    .from('profiles')
    .select('first_name, last_name')
    .eq('application_slug', params.slug)
    .maybeSingle();
  const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null;
  return { title: name ? `Start your application with ${name}` : 'Start your application' };
}

export default async function ApplyBySlugPage({ params }: { params: { slug: string } }) {
  const sb = createAdminClient();

  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, nmls_id, org_id')
    .eq('application_slug', params.slug)
    .maybeSingle();

  if (!profile) notFound();

  const { data: org } = await sb
    .from('organizations')
    .select('name')
    .eq('id', profile.org_id)
    .maybeSingle();

  // Route the CTA into the existing Phase 61 referral intake, attributed to this LO.
  const refCode = await ensureReferralCode(profile.org_id, profile.id, profile.last_name);

  return (
    <ApplyClient
      fullName={`${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'your loan officer'}
      avatarUrl={profile.avatar_url}
      nmlsId={profile.nmls_id}
      orgName={org?.name ?? null}
      ctaHref={`/apply?ref=${encodeURIComponent(refCode)}`}
    />
  );
}
