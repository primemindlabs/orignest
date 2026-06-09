import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const STAGE_LABELS: Record<string, string> = { closed: 'Closed', clear_to_close: 'Clear to Close', underwriting: 'Underwriting', processing: 'Processing', application: 'Application', pre_qual: 'Pre-Qual', new_inquiry: 'New', conditional_approval: 'Cond. Approval', declined: 'Declined', withdrawn: 'Withdrawn' };

export default async function LoanHistoryPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: rel } = await sb.from('borrower_relationships').select('lead_ids').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!rel) notFound();

  const { data: leads } = (rel.lead_ids ?? []).length
    ? await sb.from('leads').select('id, stage, loan_purpose, loan_amount, closing_date, property_city, property_state, created_at').in('id', rel.lead_ids).order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Loan History</h1>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
        {(leads ?? []).map((l: any) => (
          <Link key={l.id} href={`/loans/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--c-fill)]">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--c-text)] truncate">{[l.property_city, l.property_state].filter(Boolean).join(', ') || 'Loan'}</p>
              <p className="text-[11px] text-[var(--c-label2)]">{l.loan_purpose ? l.loan_purpose.replace(/_/g, ' ') : ''}{l.closing_date ? ` · ${new Date(l.closing_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {l.loan_amount && <span className="text-[12px] font-mono tabular-nums text-[var(--c-text)]">{usd(Number(l.loan_amount))}</span>}
              <span className="text-[10px] text-[var(--c-label2)] bg-[var(--c-fill)] px-1.5 py-0.5 rounded-full">{STAGE_LABELS[l.stage] ?? l.stage}</span>
            </div>
          </Link>
        ))}
        {(leads ?? []).length === 0 && <p className="text-[13px] text-[var(--c-label3)] text-center py-6">No loans on record.</p>}
      </div>
    </div>
  );
}
