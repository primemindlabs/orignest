import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, PartyPopper } from 'lucide-react';
import { ClosingPostGenerator } from '@/components/closing-posts/ClosingPostGenerator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Closing Celebration' };

export default async function ClosingPostPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, property_city, property_state, loan_type, stage')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const { data: profile } = await sb
    .from('profiles')
    .select('first_name, last_name, nmls_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();

  const loName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your loan officer';
  const isClosed = lead.stage === 'closed';

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href={`/leads/${params.loanId}`} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> {lead.first_name} {lead.last_name}
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight flex items-center gap-2">
          <PartyPopper size={20} className="text-[var(--c-gold-deep)]" /> Closing Celebration
        </h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Generate a compliant social post celebrating this closing. Every draft is pre-filtered for Reg Z / UDAP —
          no rates, dollar amounts, or payment figures. Review, edit, and copy to share.
        </p>
      </div>

      {isClosed ? (
        <ClosingPostGenerator
          leadId={lead.id}
          leadInfo={{
            first_name: lead.first_name ?? '',
            property_city: lead.property_city ?? '',
            property_state: lead.property_state ?? '',
            loan_type: lead.loan_type ?? 'Conventional',
          }}
          loProfile={{ name: loName, company: org?.name ?? '', nmls: profile?.nmls_id ?? '' }}
        />
      ) : (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-6 text-center">
          <p className="text-[14px] font-medium text-[var(--c-text)]">This loan hasn&apos;t closed yet</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-1">
            The closing celebration becomes available once the loan reaches the <strong>Closed</strong> stage.
          </p>
        </div>
      )}
    </div>
  );
}
