// Phase 123 — Annual Mortgage Review. pg_cron → Bearer CRON_SECRET (matches the app's
// cron convention, not the spec's x-internal-secret). Fires on closing anniversaries:
// for each funded loan whose closing month/day is today and is ≥1 year old, insert a
// review record and notify the borrower (email gated via Resend, SMS via TCPA gate).
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendSMS } from '@/lib/communications/canSendSMS';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function twilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const today = new Date();
  const mm = today.getUTCMonth();
  const dd = today.getUTCDate();

  const { data: leads } = await sb
    .from('leads')
    .select('id, org_id, first_name, email, phone, closing_date, estimated_value, loan_amount, original_rate')
    .eq('stage', 'closed')
    .not('closing_date', 'is', null)
    .limit(2000);

  const due = (leads ?? []).filter((l) => {
    const d = new Date(l.closing_date as string);
    return d.getUTCMonth() === mm && d.getUTCDate() === dd && today.getUTCFullYear() - d.getUTCFullYear() >= 1;
  });

  const { data: mkt } = await sb.from('market_rate_snapshots').select('rate').ilike('product', '%30%').order('snapshot_date', { ascending: false }).limit(1).maybeSingle();
  const marketRate = mkt?.rate != null ? Number(mkt.rate) : null;

  const result = { due: due.length, inserted: 0, emailed: 0, texted: 0, skipped: 0 };
  const resendOn = !!process.env.RESEND_API_KEY;
  const portalBase = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';

  for (const l of due) {
    const reviewYear = today.getUTCFullYear() - new Date(l.closing_date as string).getUTCFullYear();

    const { data: existing } = await sb.from('annual_mortgage_reviews').select('id').eq('lead_id', l.id).eq('review_year', reviewYear).maybeSingle();
    if (existing) { result.skipped++; continue; }

    const homeValue = l.estimated_value != null ? Number(l.estimated_value) : null;
    const balance = l.loan_amount != null ? Number(l.loan_amount) : null;
    const equityGained = homeValue != null && balance != null ? Math.max(0, homeValue - balance) : null;
    const currentRate = l.original_rate != null ? Number(l.original_rate) : null;
    const refiSavings = currentRate != null && marketRate != null && currentRate - marketRate > 0.25 && balance ? Math.round((currentRate - marketRate) * balance / 12 * 0.8) : null;

    await sb.from('annual_mortgage_reviews').insert({
      lead_id: l.id, org_id: l.org_id, review_year: reviewYear,
      equity_gained: equityGained, current_home_value: homeValue,
      current_rate: currentRate, market_rate: marketRate, refi_savings_potential: refiSavings,
    });
    result.inserted++;

    // Find the borrower's portal token (most recent) for the report link.
    const { data: tok } = await sb.from('borrower_portal_tokens').select('token').eq('lead_id', l.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const portalUrl = tok?.token ? `${portalBase}/status/${tok.token}` : portalBase;

    // Email (gated through the canonical CAN-SPAM-safe sender).
    if (resendOn && l.email) {
      try {
        const { sendCompliantEmail } = await import('@/lib/resend');
        await sendCompliantEmail({
          to: l.email as string, recipientEmail: l.email as string, orgId: l.org_id as string, leadId: l.id as string,
          subject: `Your Annual Mortgage Review — Year ${reviewYear}`,
          html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#1A1816;">
            <p>Hi ${l.first_name ?? 'there'},</p>
            <p style="line-height:1.6;">Your Year ${reviewYear} mortgage review is ready.${equityGained != null ? ` Your home has built an estimated <strong>$${equityGained.toLocaleString()}</strong> in equity.` : ''}</p>
            <a href="${portalUrl}" style="display:inline-block;background:#C9A95C;color:#5A3E15;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">View your full report</a>
            <p style="margin-top:24px;color:#9B9590;font-size:12px;">This is not a commitment to lend. Rates and terms subject to change. Equal Housing Lender.</p>
          </div>`,
        });
        await sb.from('annual_mortgage_reviews').update({ email_sent_at: new Date().toISOString() }).eq('lead_id', l.id).eq('review_year', reviewYear);
        result.emailed++;
      } catch { /* best-effort */ }
    }

    // SMS — TCPA gate (consent + window) then Twilio-gated.
    if (l.phone) {
      const gate = await canSendSMS(sb, { orgId: l.org_id as string, leadId: l.id as string, category: 'marketing' });
      if (gate.allowed && twilioConfigured()) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
          await client.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER!, to: l.phone as string,
            body: `Hi ${l.first_name ?? 'there'}! Your Year ${reviewYear} mortgage review is ready${equityGained != null ? ` — your home gained ~$${equityGained.toLocaleString()} in equity` : ''}. View it: ${portalUrl}`,
          });
          await sb.from('annual_mortgage_reviews').update({ sms_sent_at: new Date().toISOString() }).eq('lead_id', l.id).eq('review_year', reviewYear);
          result.texted++;
        } catch { /* best-effort */ }
      }
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
