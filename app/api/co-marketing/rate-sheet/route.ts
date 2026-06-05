import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface RateSheetRequest {
  partnerId: string;
  loId: string;
  indicativeRates?: {
    conventional30yr?: number;
    fha30yr?: number;
    va30yr?: number;
    jumbo30yr?: number;
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as RateSheetRequest;
    const { partnerId, loId, indicativeRates } = body;

    if (!partnerId || !loId) {
      return NextResponse.json({ error: 'partnerId and loId are required' }, { status: 400 });
    }

    const sb = createClient();

    const [{ data: partner }, { data: lo }, { data: org }] = await Promise.all([
      sb.from('referral_partners').select('*').eq('id', partnerId).maybeSingle(),
      sb.from('profiles').select('*').eq('id', loId).maybeSingle(),
      sb.from('organizations').select('*').eq('clerk_org_id', orgId).maybeSingle(),
    ]);

    if (!partner || !lo || !org) {
      return NextResponse.json({ error: 'Partner, LO, or organization not found' }, { status: 404 });
    }

    const today = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    const rateRows = indicativeRates
      ? Object.entries({
          'Conventional 30-Year': indicativeRates.conventional30yr,
          'FHA 30-Year': indicativeRates.fha30yr,
          'VA 30-Year': indicativeRates.va30yr,
          'Jumbo 30-Year': indicativeRates.jumbo30yr,
        })
          .filter(([, rate]) => rate != null)
          .map(([label, rate]) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">${label}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:#1a1a1a;">${rate?.toFixed(3)}%*</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#666;">Subject to change</td>
            </tr>`)
          .join('')
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rate Sheet — ${org.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f7; }
  .page { max-width: 680px; margin: 0 auto; background: #fff; }
  .header { background: #0F1D2E; color: #fff; padding: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 22px; font-weight: 700; color: #C9A95C; letter-spacing: -0.5px; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; }
  .contacts { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 28px 32px; border-bottom: 1px solid #eee; }
  .contact-card { background: #f9f9fb; border-radius: 12px; padding: 16px; }
  .contact-role { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #8a8a8e; margin-bottom: 8px; }
  .contact-name { font-size: 16px; font-weight: 600; color: #1a1a1a; }
  .contact-detail { font-size: 12px; color: #666; margin-top: 2px; }
  .rates-section { padding: 28px 32px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #8a8a8e; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #8a8a8e; border-bottom: 2px solid #eee; }
  .disclaimer { padding: 20px 32px 28px; background: #f9f9fb; border-top: 1px solid #eee; }
  .disclaimer p { font-size: 10px; color: #8a8a8e; line-height: 1.6; }
  .footer { background: #0F1D2E; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .footer-text { font-size: 11px; color: rgba(255,255,255,0.5); }
  .equal-housing { font-size: 11px; color: #C9A95C; font-weight: 600; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">${org.name}</div>
      <div class="header-sub">Indicative Rate Sheet — ${today}</div>
    </div>
    ${org.nmls_company_id ? `<div style="font-size:11px;color:rgba(255,255,255,0.5);">NMLS #${org.nmls_company_id}</div>` : ''}
  </div>

  <div class="contacts">
    <div class="contact-card">
      <div class="contact-role">Your Loan Officer</div>
      <div class="contact-name">${lo.first_name} ${lo.last_name}</div>
      ${lo.nmls_id ? `<div class="contact-detail">NMLS #${lo.nmls_id}</div>` : ''}
      <div class="contact-detail">${lo.email}</div>
      ${lo.phone ? `<div class="contact-detail">${lo.phone}</div>` : ''}
    </div>
    <div class="contact-card">
      <div class="contact-role">Your Real Estate Agent</div>
      <div class="contact-name">${partner.first_name} ${partner.last_name}</div>
      <div class="contact-detail">${partner.company_name}</div>
      <div class="contact-detail">${partner.email}</div>
      ${partner.phone ? `<div class="contact-detail">${partner.phone}</div>` : ''}
    </div>
  </div>

  ${rateRows ? `
  <div class="rates-section">
    <div class="section-title">Today's Indicative Rates</div>
    <table>
      <thead>
        <tr>
          <th>Loan Program</th>
          <th>Interest Rate</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rateRows}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="disclaimer">
    <p>*Rates shown are indicative only and subject to change without notice based on market conditions, borrower qualifications, property type, loan-to-value ratio, and other factors. This is not a commitment to lend. Subject to credit approval. Equal Housing Lender. ${org.nmls_company_id ? `NMLS Consumer Access: ${org.name} NMLS #${org.nmls_company_id}.` : ''} ${lo.nmls_id ? `${lo.first_name} ${lo.last_name} NMLS #${lo.nmls_id}.` : ''}</p>
  </div>

  <div class="footer">
    <div class="footer-text">Powered by Orignest · orignest.app</div>
    <div class="equal-housing">Equal Housing Lender</div>
  </div>
</div>
</body>
</html>`;

    return NextResponse.json({ html, partnerName: `${partner.first_name} ${partner.last_name}`, loName: `${lo.first_name} ${lo.last_name}` });
  } catch (err) {
    console.error('[co-marketing/rate-sheet] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
