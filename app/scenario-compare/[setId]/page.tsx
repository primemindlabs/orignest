// Phase 115 — print-friendly loan scenario comparison (LO-authenticated, outside the
// dashboard shell). Browser print-to-PDF. The NMLS disclaimer is injected here and is
// never omittable.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PrintButton } from '@/components/loan/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Loan Comparison', robots: 'noindex' };

const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);

export default async function ScenarioComparePage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: set } = await sb.from('scenario_sets').select('*').eq('id', setId).eq('org_id', orgId).maybeSingle();
  if (!set) notFound();

  const { data: scenarios } = await sb
    .from('loan_scenarios')
    .select('*')
    .in('id', (set.scenario_ids as string[]) ?? [])
    .eq('org_id', orgId);
  const ordered = (set.scenario_ids as string[]).map((id) => (scenarios ?? []).find((s) => s.id === id)).filter(Boolean) as any[];

  const [{ data: lo }, { data: org }] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, nmls_id, phone').eq('id', set.lo_id).maybeSingle(),
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
  ]);
  const loName = lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() : 'Your Loan Officer';

  const rows: [string, (s: any) => string][] = [
    ['Loan type', (s) => (s.loan_type ?? '').replace(/_/g, ' ')],
    ['Purchase price', (s) => usd(s.purchase_price)],
    ['Down payment', (s) => `${usd((s.purchase_price ?? 0) - (s.loan_amount ?? 0))} (${Number(s.down_payment_pct ?? 0)}%)`],
    ['Loan amount', (s) => usd(s.loan_amount)],
    ['Rate', (s) => `${Number(s.interest_rate ?? 0).toFixed(3)}%`],
    ['Term', (s) => `${Math.round((s.loan_term_months ?? 360) / 12)} yr`],
    ['Total interest', (s) => usd(s.total_interest_paid)],
    ['Total cost of loan', (s) => usd(s.total_cost_of_loan)],
  ];

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 32, fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif', color: '#111' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>{set.title}</h1>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Prepared by {loName}{org?.name ? ` · ${org.name}` : ''}</p>
          </div>
          <PrintButton />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 8px', color: '#9ca3af', fontWeight: 500, fontSize: 11 }} />
              {ordered.map((s) => (
                <th key={s.id} style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #C9A95C' }}>
                  <div style={{ fontWeight: 700 }}>{s.scenario_name}</div>
                  {s.is_recommended && (
                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600, color: '#fff', background: '#C9A95C', borderRadius: 999, padding: '2px 8px' }}>
                      Recommended
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 8px', color: '#9ca3af', fontSize: 11 }}>Monthly P&amp;I</td>
              {ordered.map((s) => (
                <td key={s.id} style={{ padding: '12px 8px', fontSize: 20, fontWeight: 700 }}>{usd(s.monthly_payment)}</td>
              ))}
            </tr>
            {rows.map(([label, fn]) => (
              <tr key={label} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px', color: '#6b7280' }}>{label}</td>
                {ordered.map((s) => (
                  <td key={s.id} style={{ padding: '8px', textTransform: 'capitalize' }}>{fn(s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {ordered.some((s) => (s.loan_type ?? '').startsWith('arm_')) && (
          <p style={{ fontSize: 11, color: '#8f5500', marginTop: 12 }}>
            ARM scenarios: the rate shown is the initial-period rate. The monthly payment may increase after the initial fixed period.
          </p>
        )}

        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #e5e7eb', fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
          <p style={{ fontWeight: 600, color: '#111' }}>{loName}{lo?.nmls_id ? ` · NMLS #${lo.nmls_id}` : ''}{org?.name ? ` · ${org.name}` : ''}{lo?.phone ? ` · ${lo.phone}` : ''}</p>
          <p style={{ marginTop: 6 }}>
            This is an estimate for comparison purposes only and is not a commitment to lend, a Loan Estimate, or an
            offer of credit. Rates, payments, and terms are subject to change, credit approval, and verification. Payment
            figures shown are principal &amp; interest only and do not include taxes, insurance, HOA, or mortgage
            insurance, which will increase the total monthly payment. Equal Housing Lender.
          </p>
        </div>
      </div>
    </div>
  );
}
