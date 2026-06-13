// Phase 121 — monthly referral-partner summary (pg_cron → Bearer CRON_SECRET, 1st of month).
// For each active partner with >=1 referral in the last 90 days, email a short summary
// of their referrals/in-process/funded counts. Resend-gated; logs to partner_update_emails.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  // Partners active in the last 90 days, with their LO identity for the NMLS line.
  const { data: recent } = await sb
    .from('partner_referrals')
    .select('partner_id, status, org_id')
    .gte('created_at', since);

  const byPartner = new Map<string, { total: number; in_process: number; funded: number; org_id: string }>();
  for (const r of recent ?? []) {
    const e = byPartner.get(r.partner_id as string) ?? { total: 0, in_process: 0, funded: 0, org_id: r.org_id as string };
    e.total += 1;
    if (r.status === 'in_process' || r.status === 'contacted') e.in_process += 1;
    if (r.status === 'funded') e.funded += 1;
    byPartner.set(r.partner_id as string, e);
  }

  const result = { partners: byPartner.size, sent: 0, gated: 0, skipped: 0 };
  if (byPartner.size === 0) return NextResponse.json({ ok: true, ...result });

  const ids = Array.from(byPartner.keys());
  const { data: partners } = await sb
    .from('referral_partners')
    .select('id, org_id, added_by, first_name, last_name, email, active')
    .in('id', ids);

  const resendOn = !!process.env.RESEND_API_KEY;
  const { sendCompliantEmail } = resendOn ? await import('@/lib/resend') : { sendCompliantEmail: null as never };

  for (const p of partners ?? []) {
    if (!p.active || !p.email) { result.skipped++; continue; }
    const c = byPartner.get(p.id as string)!;

    const { data: lo } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('id', p.added_by as string).maybeSingle();
    const loName = lo ? [lo.first_name, lo.last_name].filter(Boolean).join(' ') || 'Your loan officer' : 'Your loan officer';
    const nmls = lo?.nmls_id ? `NMLS# ${lo.nmls_id}` : 'NMLS ID on file';

    if (!resendOn) {
      result.gated++;
      await sb.from('partner_update_emails').insert({ org_id: p.org_id, partner_id: p.id, update_type: 'monthly_summary' });
      continue;
    }

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#0F1D2E;">
        <p>Hi ${p.first_name},</p>
        <p style="line-height:1.6;">Here's a quick summary of the clients you referred over the last 90 days. Thank you for your continued partnership.</p>
        <table style="border-collapse:collapse;font-size:15px;margin:16px 0;">
          <tr><td style="padding:4px 16px 4px 0;color:#6C6C70;">Referrals</td><td style="font-weight:700;">${c.total}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6C6C70;">In process</td><td style="font-weight:700;">${c.in_process}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6C6C70;">Funded</td><td style="font-weight:700;">${c.funded}</td></tr>
        </table>
        <p style="margin-top:20px;">Warm regards,<br/><strong>${loName}</strong></p>
        <p style="margin-top:28px;color:#9A9AA0;font-size:12px;line-height:1.5;">
          ${loName}, ${nmls}. This summary concerns clients you referred and is not an advertisement for a
          specific loan product, rate, or term. Equal Housing Lender.
        </p>
      </div>`;

    try {
      const res = await sendCompliantEmail({ to: p.email as string, recipientEmail: p.email as string, subject: 'Your referral summary', html, orgId: p.org_id as string });
      await sb.from('partner_update_emails').insert({ org_id: p.org_id, partner_id: p.id, update_type: 'monthly_summary', resend_message_id: res?.id ?? null });
      await sb.from('referral_partners').update({ last_outreach_at: new Date().toISOString() }).eq('id', p.id);
      result.sent++;
    } catch {
      result.skipped++;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
