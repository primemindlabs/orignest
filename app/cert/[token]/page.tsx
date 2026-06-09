import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { ShieldCheck, BadgeCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pre-Approval Certificate',
  robots: { index: false, follow: false },
};

// Stages at which a borrower has a meaningful pre-approval to share.
const ELIGIBLE_STAGES = [
  'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close',
];

const PURPOSE_LABELS: Record<string, string> = {
  purchase: 'Home Purchase',
  rate_term_refinance: 'Rate/Term Refinance',
  cash_out_refinance: 'Cash-Out Refinance',
  heloc: 'HELOC',
  construction: 'Construction',
};

function fmtMoney(n: number | null): string {
  if (!n) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default async function CertPage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: tok } = await sb
    .from('borrower_portal_tokens')
    .select('org_id, lead_id, expires_at, created_at')
    .eq('token', params.token)
    .maybeSingle();

  if (!tok) notFound();
  if (tok.expires_at && new Date(tok.expires_at) < new Date()) notFound();

  const { data: lead } = await sb
    .from('leads')
    .select('first_name, last_name, stage, loan_purpose, loan_amount, down_payment, assigned_to')
    .eq('id', tok.lead_id)
    .eq('org_id', tok.org_id)
    .maybeSingle();

  if (!lead) notFound();

  const { data: org } = await sb
    .from('organizations')
    .select('name, nmls_company_id')
    .eq('id', tok.org_id)
    .maybeSingle();

  const lo = lead.assigned_to
    ? await sb
        .from('profiles')
        .select('first_name, last_name, nmls_id, phone')
        .eq('id', lead.assigned_to)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const eligible = ELIGIBLE_STAGES.includes(lead.stage);

  // Validity: 90 days from issuance (token creation).
  const issued = tok.created_at ? new Date(tok.created_at) : new Date();
  const validThrough = new Date(issued.getTime() + 90 * 86_400_000);
  const expired = validThrough < new Date();

  if (!eligible) {
    return (
      <Shell>
        <div className="text-center py-10">
          <ShieldCheck size={32} className="text-label-3 mx-auto mb-3" />
          <p className="text-sm text-label-2">
            A pre-approval certificate isn&apos;t available yet for this application. It becomes
            shareable once pre-qualification is complete.
          </p>
        </div>
      </Shell>
    );
  }

  const purchasePower =
    lead.loan_purpose === 'purchase' && lead.loan_amount
      ? lead.loan_amount + (lead.down_payment ?? 0)
      : null;

  return (
    <Shell>
      <div className="text-center border-b border-gold-200 pb-5">
        <div className="inline-flex items-center gap-1.5 text-gold-700 text-[12px] font-semibold uppercase tracking-widest mb-2">
          <BadgeCheck size={15} />
          Pre-Approval Certificate
        </div>
        <h1 className="text-[26px] font-bold text-navy tracking-tight">
          {lead.first_name} {lead.last_name}
        </h1>
        <p className="text-sm text-label-2 mt-1">
          is pre-approved for {PURPOSE_LABELS[lead.loan_purpose ?? ''] ?? 'financing'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 py-5">
        <Stat label={purchasePower ? 'Estimated Purchase Power' : 'Pre-Approval Amount'} value={fmtMoney(purchasePower ?? lead.loan_amount)} emphasis />
        {lead.loan_purpose === 'purchase' && (
          <Stat label="Financing Amount" value={fmtMoney(lead.loan_amount)} />
        )}
        <Stat
          label="Valid Through"
          value={validThrough.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        />
        <Stat label="Issued" value={issued.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
      </div>

      {expired && (
        <p className="text-[12px] text-red bg-red/5 border border-red/20 rounded-[8px] px-3 py-2 text-center">
          This certificate has expired. Please ask the borrower&apos;s loan officer for an updated one.
        </p>
      )}

      <div className="border-t border-gold-200 pt-5 space-y-1">
        <p className="text-xs text-label-3 uppercase tracking-wide font-semibold">Issued by</p>
        <p className="text-sm font-semibold text-label">{org?.name ?? 'Your Lender'}</p>
        {lo && (
          <p className="text-sm text-label-2">
            {lo.first_name} {lo.last_name}
            {lo.nmls_id ? ` · NMLS #${lo.nmls_id}` : ''}
            {lo.phone ? ` · ${lo.phone}` : ''}
          </p>
        )}
        {org?.nmls_company_id && (
          <p className="text-xs text-label-3">Company NMLS #{org.nmls_company_id}</p>
        )}
      </div>

      <p className="text-[11px] text-label-3 leading-relaxed border-t border-gold-200 pt-4">
        This certificate reflects a preliminary pre-approval based on information provided and is not
        a commitment to lend. Final approval is subject to verification of income, assets, credit, an
        acceptable appraisal, and underwriting. Equal Housing Lender.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-gold-200 p-7">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide mb-1">{label}</p>
      <p className={emphasis ? 'text-[22px] font-bold text-navy leading-tight' : 'text-[15px] font-semibold text-label'}>
        {value}
      </p>
    </div>
  );
}
