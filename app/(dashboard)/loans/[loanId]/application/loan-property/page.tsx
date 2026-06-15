import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// ---- label maps (mirror components/apply/sections/{Loan,Property}Section.tsx) ----
const LOAN_PURPOSE_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  refinance: 'Refinance',
  rate_term_refinance: 'Rate/Term Refinance',
  cash_out: 'Cash-Out Refinance',
  cash_out_refinance: 'Cash-Out Refinance',
  heloc: 'HELOC',
  construction: 'Construction',
};
const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  non_qm: 'Non-QM',
  heloc: 'HELOC',
  construction: 'Construction',
  reverse: 'Reverse',
  commercial: 'Commercial',
  dscr: 'DSCR',
};
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  condo: 'Condominium',
  townhouse: 'Townhouse',
  multi_family_2_4: 'Multi-Family (2–4 units)',
  multi_family_5plus: 'Multi-Family (5+ units)',
  commercial: 'Commercial',
  land: 'Land',
  primary: 'Single Family',
  investment: 'Investment',
  second_home: 'Second Home',
};
const OCCUPANCY_LABELS: Record<string, string> = {
  primary_residence: 'Primary Residence',
  second_home: 'Second Home',
  investment_property: 'Investment Property',
};

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function label(map: Record<string, string>, key: string | null | undefined): string | null {
  if (!key) return null;
  return map[key] ?? titleCase(key);
}

function money(v: unknown): string | null {
  const n = typeof v === 'number' ? v : v != null ? Number(v) : NaN;
  if (!Number.isFinite(n) || n === 0) return null;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pick<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v != null && v !== '') return v;
  return null;
}

interface Row {
  label: string;
  value: string | null;
}

function FieldGrid({ rows }: { rows: Row[] }) {
  const populated = rows.filter((r) => r.value);
  if (populated.length === 0) {
    return <p className="text-[13px] text-[var(--c-label3)] italic">Not provided yet on this file.</p>;
  }
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
      {populated.map((r) => (
        <div key={r.label}>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">{r.label}</dt>
          <dd className="text-[14px] font-medium text-[var(--c-text)] mt-0.5">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
      <h2 className="text-[13px] font-semibold text-[var(--c-label2)] uppercase tracking-wide mb-4">{title}</h2>
      {children}
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

  // Supplement with the digital 1003 application row if one exists (defensive: table/row may be absent).
  let app: Record<string, unknown> | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select('*')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = (data as Record<string, unknown>) ?? null;
  } catch {
    app = null;
  }

  const l = lead as Record<string, unknown>;
  const a = app ?? {};

  // ---- Loan details (prefer leads row, fall back to application) ----
  const loanAmount = money(pick(l.loan_amount, a.desired_loan_amount));
  const loanPurpose = label(LOAN_PURPOSE_LABELS, pick(l.loan_purpose as string, a.loan_purpose as string));
  const loanType = label(LOAN_TYPE_LABELS, pick(l.loan_type as string, a.loan_type_preference as string));
  const downPayment = money(pick(l.down_payment, a.down_payment_amount));
  const downSrc = pick(a.down_payment_source as string) as string | null;
  const ltv = l.ltv != null && Number(l.ltv) > 0 ? `${Number(l.ltv).toFixed(1)}%` : null;
  const rate =
    l.interest_rate != null && Number(l.interest_rate) > 0 ? `${Number(l.interest_rate).toFixed(3)}%` : null;
  const termMonths = l.loan_term_months != null ? Number(l.loan_term_months) : null;
  const term = termMonths && termMonths > 0 ? `${termMonths} mo (${Math.round(termMonths / 12)} yr)` : null;

  const loanRows: Row[] = [
    { label: 'Loan Amount', value: loanAmount },
    { label: 'Loan Purpose', value: loanPurpose },
    { label: 'Loan Type', value: loanType },
    { label: 'Down Payment', value: downPayment },
    { label: 'Down Payment Source', value: downSrc ? titleCase(downSrc) : null },
    { label: 'LTV', value: ltv },
    { label: 'Note Rate', value: rate },
    { label: 'Term', value: term },
  ];

  // ---- Subject property (prefer leads row, fall back to application) ----
  const addr = pick(l.property_address as string, a.property_address as string) as string | null;
  const city = pick(l.property_city as string, a.property_city as string) as string | null;
  const state = pick(l.property_state as string, a.property_state as string) as string | null;
  const zip = pick(l.property_zip as string, a.property_zip as string) as string | null;
  const cityStateZip = ([city, state].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '')).trim();
  const fullAddr = [addr, cityStateZip].filter(Boolean).join(' · ') || null;

  const propType = label(PROPERTY_TYPE_LABELS, pick(l.property_type as string, a.property_type as string));
  const occupancy = label(OCCUPANCY_LABELS, pick(l.occupancy_type as string));
  const purchasePrice = money(pick(l.purchase_price, a.purchase_price));
  const estValue = money(pick(l.estimated_value, a.estimated_value));

  const propRows: Row[] = [
    { label: 'Address', value: fullAddr },
    { label: 'Property Type', value: propType },
    { label: 'Occupancy', value: occupancy },
    { label: 'Purchase Price', value: purchasePrice },
    { label: 'Estimated Value', value: estValue },
  ];

  const anyData = [...loanRows, ...propRows].some((r) => r.value);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Loan &amp; Property (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Loan terms and subject-property details from the application.
        </p>
      </div>

      {!anyData && (
        <div className="bg-[var(--c-fill)] border border-dashed border-[var(--c-border)] rounded-[14px] p-6 text-center">
          <p className="text-[14px] font-medium text-[var(--c-text)]">No loan or property details yet</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1">
            These fields fill in as the borrower completes the digital 1003 or as you update the file.
          </p>
        </div>
      )}

      <Card title="Loan Details">
        <FieldGrid rows={loanRows} />
      </Card>

      <Card title="Subject Property">
        <FieldGrid rows={propRows} />
      </Card>

      {app && (
        <p className="text-[12px] text-[var(--c-label3)]">
          Values reflect the file record, supplemented by the borrower&apos;s digital 1003 where the file is blank.
        </p>
      )}
    </div>
  );
}
