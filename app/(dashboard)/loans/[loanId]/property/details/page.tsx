import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Lead = Record<string, unknown>;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  condo: 'Condominium',
  townhouse: 'Townhouse',
  multi_family_2_4: 'Multi-Family (2-4 units)',
  multi_family_5plus: 'Multi-Family (5+ units)',
  commercial: 'Commercial',
  land: 'Land',
};

const OCCUPANCY_LABELS: Record<string, string> = {
  primary_residence: 'Primary Residence',
  second_home: 'Second Home',
  investment_property: 'Investment Property',
};

const LOAN_PURPOSE_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  rate_term_refinance: 'Rate/Term Refinance',
  cash_out_refinance: 'Cash-Out Refinance',
  heloc: 'HELOC',
  construction: 'Construction',
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function usd(v: unknown): string | null {
  const n = num(v);
  if (n == null) return null;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(v: unknown): string | null {
  const n = num(v);
  if (n == null) return null;
  return `${n.toFixed(2)}%`;
}

function label(map: Record<string, string>, v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return map[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">{label}</p>
      <p className="text-[14px] text-[var(--c-text)] mt-0.5 font-medium">{value ?? <span className="text-[var(--c-label3)] font-normal">—</span>}</p>
    </div>
  );
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const l = lead as Lead;

  // Compose the address line defensively.
  const line1 = str(l.property_address);
  const cityStateZip = [str(l.property_city), str(l.property_state)].filter(Boolean).join(', ');
  const zip = str(l.property_zip);
  const fullCityLine = [cityStateZip, zip].filter(Boolean).join(' ');
  const hasAddress = Boolean(line1 || fullCityLine);

  const isCommercial = str(l.loan_category) === 'commercial' || str(l.loan_category) === 'non_agency';
  const commercialType = str(l.commercial_property_type);

  // Estimated value or purchase price — purchase loans typically use estimated_value as value.
  const value = usd(l.estimated_value);
  const loanAmount = usd(l.loan_amount);
  const downPayment = usd(l.down_payment);
  const ltv = pct(l.ltv);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Property Details</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Subject property attributes for this loan file.
        </p>
      </div>

      {/* Address card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Subject Property</p>
        {hasAddress ? (
          <div className="mt-1">
            {line1 && <p className="text-[16px] text-[var(--c-text)] font-semibold leading-snug">{line1}</p>}
            {fullCityLine && <p className="text-[14px] text-[var(--c-label2)] leading-snug">{fullCityLine}</p>}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--c-label3)] mt-1">
            No property address on file yet. Add it from the loan application or the lead record.
          </p>
        )}
      </div>

      {/* Characteristics */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide mb-3">Characteristics</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Property Type" value={label(PROPERTY_TYPE_LABELS, l.property_type)} />
          <Field label="Occupancy" value={label(OCCUPANCY_LABELS, l.occupancy_type)} />
          <Field label="Units" value={num(l.num_units) != null ? String(num(l.num_units)) : null} />
          <Field label="Square Footage" value={num(l.square_footage) != null ? `${num(l.square_footage)!.toLocaleString('en-US')} sqft` : null} />
          {isCommercial && commercialType && (
            <Field label="Commercial Type" value={commercialType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
          )}
          {num(l.occupancy_rate) != null && (
            <Field label="Occupancy Rate" value={`${(num(l.occupancy_rate)! * 100).toFixed(1)}%`} />
          )}
        </div>
      </div>

      {/* Valuation & financing */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide mb-3">Valuation &amp; Financing</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Estimated Value" value={value} />
          <Field label="Loan Amount" value={loanAmount} />
          <Field label="Down Payment" value={downPayment} />
          <Field label="LTV" value={ltv} />
          <Field label="Loan Purpose" value={label(LOAN_PURPOSE_LABELS, l.loan_purpose)} />
          {num(l.noi_annual) != null && <Field label="Annual NOI" value={usd(l.noi_annual)} />}
          {num(l.cap_rate) != null && <Field label="Cap Rate" value={`${(num(l.cap_rate)! * 100).toFixed(2)}%`} />}
        </div>
        {value == null && loanAmount == null && (
          <p className="text-[12px] text-[var(--c-label3)] mt-4">
            Valuation populates from the application or the appraisal once on file.
          </p>
        )}
      </div>
    </div>
  );
}
