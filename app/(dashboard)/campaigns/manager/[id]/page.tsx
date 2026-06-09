import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CampaignDetailClient } from './CampaignDetailClient';

export const dynamic = 'force-dynamic';

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: campaign } = await sb.from('campaigns').select('id, name, description').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!campaign) notFound();

  const { data: leads } = await sb.from('leads').select('id, first_name, last_name, stage').eq('org_id', orgId).in('stage', ACTIVE_STAGES).is('archived_at', null).order('created_at', { ascending: false }).limit(100);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/campaigns/manager" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Campaign Manager
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">{campaign.name}</h1>
        {campaign.description && <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{campaign.description}</p>}
      </div>
      <CampaignDetailClient id={params.id} candidates={(leads ?? []) as any} />
    </div>
  );
}
