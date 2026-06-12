// Phase 87 — Voicemail inbox. Reads call_records (org-scoped); empty until the gated
// Twilio→Deepgram→Ashley pipeline records inbound voicemails.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { VoicemailInbox, type CallRecord } from '@/components/voicemail/VoicemailInbox';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Voicemails' };

export default async function VoicemailsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data } = await sb
    .from('call_records')
    .select('id, lead_id, caller_number, duration_seconds, recording_url, transcript, ashley_sms_sent, created_at, pipeline_ms, leads(first_name, last_name)')
    .eq('org_id', orgId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-black tracking-tight">Voicemails</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Inbound voicemails with Ashley&apos;s instant text reply.</p>
      </div>
      <VoicemailInbox calls={(data ?? []) as CallRecord[]} />
    </div>
  );
}
