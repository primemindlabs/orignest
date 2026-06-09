import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RateDropQueue } from './RateDropQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rate Drop Campaigns' };

export default async function RateDropCampaignsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { data: drafts } = await createAdminClient()
    .from('campaign_drafts')
    .select('id, email_subject, email_body, sms_message, trigger_data, borrower_relationships(full_name, email)')
    .eq('org_id', orgId)
    .eq('campaign_type', 'rate_drop')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Campaigns
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Rate Drop Campaigns</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Personalized refi outreach drafted automatically when rates fall below a past borrower&apos;s locked rate.
        </p>
      </div>
      <RateDropQueue initial={(drafts as any) ?? []} />
    </div>
  );
}
