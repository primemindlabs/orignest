import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { RealtorAccessManager, type RealtorRow } from './RealtorAccessManager';
import { BorrowerJourneyGuide } from '@/components/portal/BorrowerJourneyGuide';
import { SharePortalCard } from '@/components/portal/SharePortalCard';

export const dynamic = 'force-dynamic';

export default async function PortalCommsPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, last_name, phone, stage, assigned_to').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const { data: loProfile } = lead.assigned_to
    ? await sb.from('profiles').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle()
    : { data: null };

  const [{ data: realtors }, { data: borrowerToken }] = await Promise.all([
    sb.from('portal_realtors').select('id, realtor_name, realtor_email, realtor_phone, permission_tier, added_by, approved_by_lo, revoked, token').eq('lead_id', params.loanId).eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('borrower_portal_tokens').select('token').eq('lead_id', params.loanId).eq('org_id', orgId).maybeSingle(),
  ]);

  // Mint a token on demand so the LO can always share in one tap.
  let token = (borrowerToken?.token as string | undefined) ?? null;
  if (!token) {
    const { data: minted } = await sb.from('borrower_portal_tokens').insert({ org_id: orgId, lead_id: params.loanId }).select('token').maybeSingle();
    token = (minted?.token as string | null) ?? null;
  }
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('host') ?? 'app.ashleyiq.com'}`;
  const portalUrl = token ? `${origin}/status/${token}` : '';
  const loName = loProfile ? [loProfile.first_name, (loProfile as { last_name?: string }).last_name].filter(Boolean).join(' ') || 'Your loan officer' : 'Your loan officer';
  const borrowerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'your borrower';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Portal &amp; Comms</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Borrower portal access and realtor partner access for this loan.</p>
      </div>

      {/* Borrower portal — co-branded share asset */}
      {portalUrl && (
        <SharePortalCard url={portalUrl} leadId={params.loanId} borrowerName={borrowerName} loName={loName} borrowerHasPhone={!!lead.phone} />
      )}

      <RealtorAccessManager loanId={params.loanId} initial={(realtors ?? []) as RealtorRow[]} />

      {/* Phase 46.2/46.3 — what the borrower sees at this stage (LO preview) */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">What {lead.first_name} sees at this stage</p>
        <BorrowerJourneyGuide stage={lead.stage} loFirstName={(loProfile as { first_name?: string } | null)?.first_name ?? ''} />
      </div>
    </div>
  );
}
