import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { RealtorAccessManager, type RealtorRow } from './RealtorAccessManager';
import { MessageSquare } from 'lucide-react';
import { BorrowerJourneyGuide } from '@/components/portal/BorrowerJourneyGuide';

export const dynamic = 'force-dynamic';

export default async function PortalCommsPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, last_name, stage, assigned_to').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const { data: loProfile } = lead.assigned_to
    ? await sb.from('profiles').select('first_name').eq('id', lead.assigned_to).maybeSingle()
    : { data: null };

  const [{ data: realtors }, { data: borrowerToken }] = await Promise.all([
    sb.from('portal_realtors').select('id, realtor_name, realtor_email, realtor_phone, permission_tier, added_by, approved_by_lo, revoked, token').eq('lead_id', params.loanId).eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('borrower_portal_tokens').select('token').eq('lead_id', params.loanId).eq('org_id', orgId).maybeSingle(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Portal &amp; Comms</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Borrower portal access and realtor partner access for this loan.</p>
      </div>

      {/* Borrower portal */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0">
          <MessageSquare size={16} className="text-[var(--c-gold-deep)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[var(--c-text)]">Borrower portal</p>
          <p className="text-[11px] text-[var(--c-label2)]">{borrowerToken ? 'Active — the borrower can track status and upload documents.' : 'Not yet generated for this loan.'}</p>
        </div>
        {borrowerToken && (
          <a href={`/status/${borrowerToken.token}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:opacity-80 flex-shrink-0">Open ↗</a>
        )}
      </div>

      <RealtorAccessManager loanId={params.loanId} initial={(realtors ?? []) as RealtorRow[]} />

      {/* Phase 46.2/46.3 — what the borrower sees at this stage (LO preview) */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">What {lead.first_name} sees at this stage</p>
        <BorrowerJourneyGuide stage={lead.stage} loFirstName={(loProfile as { first_name?: string } | null)?.first_name ?? ''} />
      </div>
    </div>
  );
}
