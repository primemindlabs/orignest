import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PowerDialerSession } from './PowerDialerSession';
import { FeatureGate } from '@/components/billing/FeatureGate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Power Dialer' };

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing'];

function webrtcReady(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET && process.env.TWILIO_TWIML_APP_SID);
}

export default async function PowerDialerPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { data: leads } = await createAdminClient()
    .from('leads')
    .select('id, first_name, last_name, phone, property_state, stage, loan_type, loan_amount, last_contacted_at')
    .eq('org_id', orgId)
    .in('stage', ACTIVE_STAGES)
    .not('phone', 'is', null)
    .eq('dnc_flagged', false)
    .order('last_contacted_at', { ascending: true, nullsFirst: true })
    .limit(50);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/dialer" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Dialer
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Power Dialer</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Work a lead queue as one focused session — TCPA-checked, with live AI coaching and auto-summarized calls.
        </p>
      </div>
      <FeatureGate feature="power_dialer">
        <PowerDialerSession candidates={(leads ?? []) as any} webrtcReady={webrtcReady()} />
      </FeatureGate>
    </div>
  );
}
