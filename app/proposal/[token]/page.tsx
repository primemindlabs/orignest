// Phase 122 — PUBLIC borrower-facing loan proposal (share_token is the credential).
// Allowlisted, robots noindex. Print-friendly (browser print-to-PDF) — no @react-pdf.
// Sets viewed_at on first open. NMLS disclaimer is hard-coded here and never omittable.
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { computePaymentBreakdown, termYears } from '@/lib/proposals/payment';
import { PrintButton } from '@/components/loan/PrintButton';
import { ProposalChoose } from '@/components/proposals/ProposalChoose';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your Loan Proposal', robots: 'noindex' };

const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: proposal } = await sb.from('loan_proposals').select('*').eq('share_token', params.token).maybeSingle();
  if (!proposal) notFound();

  // Record the first view (audit / LO insight).
  if (!proposal.viewed_at) {
    await sb.from('loan_proposals').update({ viewed_at: new Date().toISOString() }).eq('id', proposal.id);
  }

  const [{ data: lead }, { data: lo }, { data: org }] = await Promise.all([
    sb.from('leads').select('first_name, last_name, property_address, property_city, property_state').eq('id', proposal.lead_id as string).maybeSingle(),
    sb.from('profiles').select('first_name, last_name, nmls_id, phone, title, avatar_url').eq('id', proposal.lo_id as string).maybeSingle(),
    sb.from('organizations').select('name').eq('id', proposal.org_id as string).maybeSingle(),
  ]);

  const ids = [proposal.recommended_scenario_id as string, ...((proposal.comparison_scenario_ids as string[]) ?? [])];
  const { data: scenarios } = await sb.from('loan_scenarios').select('*').in('id', ids);
  const rec = (scenarios ?? []).find((s) => s.id === proposal.recommended_scenario_id);
  if (!rec) notFound();
  const comps = ((proposal.comparison_scenario_ids as string[]) ?? []).map((id) => (scenarios ?? []).find((s) => s.id === id)).filter(Boolean) as Record<string, any>[];
  const all = [rec, ...comps];

  const pb = computePaymentBreakdown(rec as any);
  const loName = lo ? [lo.first_name, lo.last_name].filter(Boolean).join(' ') || 'Your Loan Officer' : 'Your Loan Officer';
  const borrowerName = lead ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Valued Client' : 'Valued Client';
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const propAddr = lead?.property_address ? `${lead.property_address}${lead.property_city ? `, ${lead.property_city}` : ''}${lead.property_state ? `, ${lead.property_state}` : ''}` : 'Your new home';
  const nmls = lo?.nmls_id ? `NMLS# ${lo.nmls_id}` : 'NMLS ID on file';

  const Section = ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eee', padding: 28, marginBottom: 20 }}>
      {title && <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F1D2E', marginBottom: 12 }}>{title}</h2>}
      {children}
    </div>
  );

  const rows: [string, (s: any) => string][] = [
    ['Loan type', (s) => String(s.loan_type ?? '').replace(/_/g, ' ')],
    ['Term', (s) => `${termYears(s.loan_term_months)} yr`],
    ['Loan amount', (s) => usd(s.loan_amount)],
    ['Monthly P&I', (s) => usd(s.monthly_payment)],
    ['Total interest', (s) => usd(s.total_interest_paid)],
    ['Lender', (s) => s.lender_name ?? '—'],
  ];

  return (
    <div style={{ background: '#FAFAF8', minHeight: '100vh', padding: 32, fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif', color: '#111' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-5">
          <p style={{ fontSize: 12, color: '#9ca3af' }}>Prepared exclusively for {borrowerName}</p>
          <PrintButton />
        </div>

        {/* Cover */}
        <div style={{ background: 'linear-gradient(135deg,#0F1D2E,#1c3454)', borderRadius: 16, padding: 36, color: '#fff', marginBottom: 20 }}>
          <p style={{ fontSize: 13, opacity: 0.7 }}>Loan Proposal</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '6px 0' }}>{borrowerName}</h1>
          <p style={{ fontSize: 14, opacity: 0.85 }}>{propAddr}</p>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 16 }}>{today} · Prepared by {loName}{org?.name ? ` · ${org.name}` : ''} · {nmls}</p>
        </div>

        <Section title="Executive Summary">
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{proposal.executive_summary}</p>
        </Section>

        <Section title="Market Context">
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap' }}>{proposal.market_context}</p>
        </Section>

        {/* Recommended product */}
        <Section title="Recommended Loan Product">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{rec.scenario_name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: '#C9A95C', borderRadius: 999, padding: '2px 8px' }}>Recommended</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              <PayRow label="Principal & Interest" value={usd(pb.principal_interest)} bold />
              <PayRow label="Estimated property tax" value={usd(pb.est_property_tax)} />
              <PayRow label="Estimated homeowners insurance" value={usd(pb.est_homeowners_insurance)} />
              {pb.has_pmi && <PayRow label="Estimated PMI" value={usd(pb.est_pmi)} />}
              <PayRow label="Estimated total monthly" value={usd(pb.est_total_monthly)} bold top />
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Tax, insurance and PMI figures are estimates for planning only and will be confirmed during processing.</p>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', marginTop: 14, whiteSpace: 'pre-wrap' }}>{proposal.recommendation_rationale}</p>
        </Section>

        {/* Comparison */}
        {comps.length > 0 && (
          <Section title="Compare Your Options">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af', fontSize: 11 }} />
                  {all.map((s) => (
                    <th key={s.id} style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #C9A95C' }}>
                      <div style={{ fontWeight: 700 }}>{s.scenario_name}</div>
                      {s.id === rec.id && <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, fontWeight: 600, color: '#fff', background: '#C9A95C', borderRadius: 999, padding: '2px 6px' }}>Recommended</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, fn]) => (
                  <tr key={label}>
                    <td style={{ padding: '8px', color: '#6b7280' }}>{label}</td>
                    {all.map((s) => <td key={s.id} style={{ padding: '8px', fontWeight: s.id === rec.id ? 700 : 400, textTransform: label === 'Loan type' ? 'capitalize' : 'none' }}>{fn(s)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Borrower choice */}
        <Section title="Choose Your Product">
          <ProposalChoose
            token={params.token}
            options={all.map((s) => ({ id: s.id as string, name: s.scenario_name as string, recommended: s.id === rec.id }))}
            initialChoice={(proposal.borrower_choice_scenario_id as string) ?? null}
          />
        </Section>

        {/* Next steps + contact */}
        <Section title="Next Steps">
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>{proposal.next_steps}</p>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{loName}{lo?.title ? `, ${lo.title}` : ''}</p>
            {lo?.phone && <p style={{ fontSize: 13, color: '#374151' }}>{lo.phone}</p>}
            <p style={{ fontSize: 12, color: '#9ca3af' }}>{nmls}{org?.name ? ` · ${org.name}` : ''}</p>
          </div>
        </Section>

        {/* NMLS / compliance — ALWAYS present, hard-coded, never omittable */}
        <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6, padding: '0 8px 24px' }}>
          This proposal is for informational purposes only and is not a loan commitment, approval, or an offer to lend.
          Rates, payments, and terms are estimates, are subject to change, and are not guaranteed until locked and disclosed
          in accordance with applicable law. All loans are subject to credit approval and underwriting. {loName}, {nmls}.
          Equal Housing Lender.
        </p>
      </div>
    </div>
  );
}

function PayRow({ label, value, bold, top }: { label: string; value: string; bold?: boolean; top?: boolean }) {
  return (
    <tr style={top ? { borderTop: '1px solid #eee' } : undefined}>
      <td style={{ padding: '7px 8px', color: bold ? '#0F1D2E' : '#6b7280', fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: bold ? 700 : 500 }}>{value}</td>
    </tr>
  );
}
