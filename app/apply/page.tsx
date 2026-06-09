/**
 * Phase 61.1 — PUBLIC referral landing page (/apply?ref=CODE). Unauthenticated.
 * Resolves the code to the LO + company (white-label), records a link_clicked event,
 * and renders the pre-qual form. Unknown/missing code → generic page (no enumeration).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { ReferralLandingForm } from './ReferralLandingForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Get Pre-Qualified', robots: 'noindex' };

export default async function ApplyPage({ searchParams }: { searchParams: { ref?: string } }) {
  const ref = searchParams.ref ?? null;
  const sb = createAdminClient();

  let loName = 'Your Loan Officer'; let company = ''; let nmls: string | null = null; let phone: string | null = null; let referrer: string | null = null;
  if (ref) {
    const { data: code } = await sb.from('referral_codes').select('org_id, lo_id, source_loan_id').eq('code', ref).eq('is_active', true).maybeSingle();
    if (code) {
      sb.from('referral_events').insert({ org_id: code.org_id, referral_code: ref, source_loan_id: code.source_loan_id ?? null, event_type: 'link_clicked' }).then(() => undefined, () => undefined);
      const [{ data: org }, { data: lo }, { data: src }] = await Promise.all([
        sb.from('organizations').select('name').eq('id', code.org_id).maybeSingle(),
        code.lo_id ? sb.from('profiles').select('first_name, last_name, nmls_id, phone').eq('id', code.lo_id).maybeSingle() : Promise.resolve({ data: null }),
        code.source_loan_id ? sb.from('leads').select('first_name, last_name').eq('id', code.source_loan_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      company = org?.name ?? '';
      if (lo) { loName = `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() || loName; nmls = lo.nmls_id ?? null; phone = lo.phone ?? null; }
      if (src) referrer = `${src.first_name ?? ''} ${src.last_name ?? ''}`.trim() || null;
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, border: '1px solid rgba(201,169,92,0.18)', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ background: '#0F1D2E', padding: '24px 28px', color: '#fff' }}>
          {referrer && <p style={{ fontSize: 12, color: '#C9A95C', marginBottom: 6 }}>{referrer} referred you to</p>}
          <p style={{ fontSize: 18, fontWeight: 700 }}>{loName}</p>
          {company && <p style={{ fontSize: 13, color: '#9fb0c0' }}>{company}</p>}
          <p style={{ fontSize: 12, color: '#6B7B8D', marginTop: 2 }}>{nmls ? `NMLS #${nmls}` : ''}{phone ? `${nmls ? ' · ' : ''}${phone}` : ''}</p>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#0F1D2E', marginBottom: 4 }}>Get pre-qualified in minutes</p>
          <p style={{ fontSize: 13, color: '#6B7B8D', marginBottom: 16 }}>Tell us a bit about you and {loName.split(' ')[0]} will reach out.</p>
          <ReferralLandingForm refCode={ref} />
        </div>
        <div style={{ padding: '12px 28px', background: 'rgba(15,29,46,0.04)' }}>
          <p style={{ fontSize: 10, color: '#6B7B8D', lineHeight: 1.5 }}>This is not a commitment to lend or an offer of credit. Equal Housing Opportunity.{company ? ` ${company}.` : ''}{nmls ? ` NMLS #${nmls}.` : ''}</p>
        </div>
      </div>
    </div>
  );
}
