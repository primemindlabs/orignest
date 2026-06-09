import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { User, Users, Home } from 'lucide-react';

export const dynamic = 'force-dynamic';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New', pre_qual: 'Pre-Qual', application: 'Application', processing: 'Processing',
  underwriting: 'Underwriting', conditional_approval: 'Cond. Approval', clear_to_close: 'Clear to Close',
  closed: 'Closed', declined: 'Declined', withdrawn: 'Withdrawn',
};

export default async function LoanRelationshipsPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, last_name, email').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const [{ data: rel }, { data: realtors }] = await Promise.all([
    sb.from('borrower_relationships').select('lead_ids, total_loans_closed, total_volume_closed').eq('org_id', orgId).eq('email', (lead.email ?? '').toLowerCase()).maybeSingle(),
    sb.from('portal_realtors').select('realtor_name, realtor_email, permission_tier, revoked').eq('lead_id', params.loanId).eq('org_id', orgId).eq('revoked', false),
  ]);

  // Other loans for this borrower.
  const otherIds = (rel?.lead_ids ?? []).filter((id: string) => id !== params.loanId);
  const { data: otherLoans } = otherIds.length
    ? await sb.from('leads').select('id, stage, loan_amount, loan_purpose, closing_date, property_city, property_state').in('id', otherIds).order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Relationships</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Lifetime view of this borrower and the realtors on this loan.</p>
      </div>

      {/* Borrower */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <User size={15} className="text-[var(--c-label2)]" />
          <h2 className="text-[13px] font-semibold text-[var(--c-text)]">{lead.first_name} {lead.last_name}</h2>
        </div>
        <p className="text-[12px] text-[var(--c-label2)] mb-3">{(rel?.lead_ids?.length ?? 1)} loan{(rel?.lead_ids?.length ?? 1) > 1 ? 's' : ''} with you</p>
        {(otherLoans ?? []).length > 0 ? (
          <div className="space-y-2">
            {(otherLoans ?? []).map((l: any) => (
              <Link key={l.id} href={`/loans/${l.id}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--c-border)] px-3 py-2 hover:bg-[var(--c-fill)]">
                <div className="flex items-center gap-2 min-w-0">
                  <Home size={13} className="text-[var(--c-label3)]" />
                  <span className="text-[12px] text-[var(--c-text)] truncate">{[l.property_city, l.property_state].filter(Boolean).join(', ') || 'Loan'}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {l.loan_amount && <span className="text-[12px] font-mono tabular-nums text-[var(--c-text)]">{usd(Number(l.loan_amount))}</span>}
                  <span className="text-[10px] text-[var(--c-label2)] bg-[var(--c-fill)] px-1.5 py-0.5 rounded-full">{STAGE_LABELS[l.stage] ?? l.stage}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--c-label3)]">This is the borrower&apos;s first loan with you.</p>
        )}
      </div>

      {/* Realtors */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-[var(--c-label2)]" />
          <h2 className="text-[13px] font-semibold text-[var(--c-text)]">Realtors on this loan</h2>
        </div>
        {(realtors ?? []).length > 0 ? (
          <div className="space-y-2">
            {(realtors ?? []).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--c-border)] px-3 py-2">
                <div className="min-w-0"><p className="text-[12px] font-medium text-[var(--c-text)] truncate">{r.realtor_name}</p><p className="text-[11px] text-[var(--c-label2)] truncate">{r.realtor_email}</p></div>
                <span className="text-[10px] text-[var(--c-gold-deep)] bg-[var(--c-gold-light)] px-1.5 py-0.5 rounded-full flex-shrink-0">{r.permission_tier.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--c-label3)]">No realtors linked. Add one from <Link href={`/loans/${params.loanId}/portal`} className="text-[var(--c-gold-deep)] hover:underline">Portal &amp; Comms</Link>.</p>
        )}
      </div>
    </div>
  );
}
