import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type ReoEntry = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  property_type?: string | null;
  status?: string | null; // 'retained' | 'sold' | 'pending_sale' | 'rental'
  market_value?: number | string | null;
  mortgage_balance?: number | string | null;
  monthly_payment?: number | string | null;
  monthly_rent?: number | string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function statusTone(s?: string | null): string {
  switch ((s ?? '').toLowerCase()) {
    case 'sold':
      return 'var(--c-label3)';
    case 'pending_sale':
    case 'pending':
      return 'var(--c-warning)';
    case 'rental':
    case 'rented':
      return 'var(--c-success)';
    default:
      return 'var(--c-gold-deep)';
  }
}

function statusLabel(s?: string | null): string {
  const v = (s ?? '').toLowerCase();
  if (!v) return 'Retained';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

  // REO entries live in the Phase 43 loan_file_data jsonb on the lead, populated by
  // the 1003 flow / underwriting. Defensive: tolerate missing key or non-array shape.
  const fileData = (lead.loan_file_data ?? {}) as Record<string, unknown>;
  const rawReo = fileData.real_estate_owned ?? fileData.reo ?? fileData.other_properties;
  const reo: ReoEntry[] = Array.isArray(rawReo) ? (rawReo as ReoEntry[]) : [];

  // Latest application gives the subject-property context (best-effort; table may be empty).
  let app: {
    property_address?: string | null;
    property_city?: string | null;
    property_state?: string | null;
    property_zip?: string | null;
    property_type?: string | null;
    loan_purpose?: string | null;
    estimated_value?: number | string | null;
  } | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select('property_address, property_city, property_state, property_zip, property_type, loan_purpose, estimated_value, updated_at')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = data ?? null;
  } catch {
    app = null;
  }

  const applyHref = `/loans/${params.loanId}/apply-1003`;

  const totalValue = reo.reduce((s, p) => s + (num(p.market_value) ?? 0), 0);
  const totalDebt = reo.reduce((s, p) => s + (num(p.mortgage_balance) ?? 0), 0);
  const totalEquity = totalValue - totalDebt;
  const totalRent = reo.reduce((s, p) => s + (num(p.monthly_rent) ?? 0), 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Real Estate Owned (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Additional properties this borrower owns, captured on the Uniform Residential Loan Application.
        </p>
      </div>

      {app?.property_address ? (
        <div className="bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[12px] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Subject property (this loan)</p>
          <p className="text-[14px] text-[var(--c-text)] font-medium mt-0.5">
            {app.property_address}
            {app.property_city ? `, ${app.property_city}` : ''}
            {app.property_state ? `, ${app.property_state}` : ''} {app.property_zip ?? ''}
          </p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">
            {app.property_type ? statusLabel(app.property_type) : 'Property'}
            {app.loan_purpose ? ` · ${statusLabel(app.loan_purpose)}` : ''}
            {num(app.estimated_value) != null ? ` · Est. value ${money(num(app.estimated_value))}` : ''}
          </p>
        </div>
      ) : null}

      {reo.length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <p className="text-[15px] font-semibold text-[var(--c-text)]">No additional properties on this file</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-md mx-auto leading-relaxed">
            This borrower has no other real estate recorded beyond the subject property. REO schedules are
            collected through the digital 1003.
          </p>
          <Link
            href={applyHref}
            className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-[10px] bg-[var(--c-gold-deep)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Open the 1003 application
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { k: 'Properties', v: String(reo.length) },
              { k: 'Total value', v: money(totalValue) },
              { k: 'Total equity', v: money(totalEquity) },
              { k: 'Gross rent / mo', v: money(totalRent) },
            ].map((s) => (
              <div key={s.k} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">{s.k}</p>
                <p className="text-[16px] font-bold tabular-nums text-[var(--c-text)] mt-1">{s.v}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {reo.map((p, i) => {
              const value = num(p.market_value);
              const balance = num(p.mortgage_balance);
              const equity = value != null && balance != null ? value - balance : null;
              const addr = [p.address, p.city, p.state].filter(Boolean).join(', ');
              const isRental = (p.status ?? '').toLowerCase().includes('rent');
              return (
                <div
                  key={`${p.address ?? 'property'}-${i}`}
                  className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--c-text)]">
                        {addr || `Property ${i + 1}`}
                        {p.zip ? ` ${p.zip}` : ''}
                      </p>
                      <p className="text-[12px] text-[var(--c-label2)] mt-0.5">
                        {p.property_type ? statusLabel(p.property_type) : 'Property'}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[11px] font-medium px-2 py-1 rounded-full"
                      style={{ color: statusTone(p.status), backgroundColor: 'var(--c-fill)' }}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[var(--c-border)]">
                    <Field label="Market value" value={money(value)} />
                    <Field label="Mortgage balance" value={money(balance)} />
                    <Field label="Equity" value={money(equity)} />
                    <Field
                      label={isRental ? 'Monthly rent' : 'Monthly payment'}
                      value={money(num(isRental ? p.monthly_rent : p.monthly_payment))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[12px] text-[var(--c-label3)]">
              REO entries are sourced from the borrower&apos;s 1003 submission.
            </p>
            <Link href={applyHref} className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline">
              Edit on the 1003 →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">{label}</p>
      <p className="text-[13px] font-medium tabular-nums text-[var(--c-text)] mt-0.5">{value}</p>
    </div>
  );
}
