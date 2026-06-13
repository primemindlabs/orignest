// Phase 121 — PUBLIC referral submit. No auth: the referral_code IS the credential.
// Allowlisted in middleware. Rate-limited 10/hour per IP (hashed). Creates a
// partner_referrals row and alerts the LO (in-app always; SMS Twilio-gated).
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : '') || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const sb = createAdminClient();

  const { data: partner } = await sb
    .from('referral_partners')
    .select('id, org_id, added_by, first_name, last_name')
    .eq('referral_code', params.code)
    .eq('active', true)
    .maybeSingle();
  if (!partner) return NextResponse.json({ error: 'This referral link is not active.' }, { status: 404 });

  const b = await request.json().catch(() => ({}));
  const first = (b.borrower_first_name ?? '').toString().trim();
  const last = (b.borrower_last_name ?? '').toString().trim();
  if (!first || !last) return NextResponse.json({ error: 'Please enter the client first and last name.' }, { status: 400 });

  // Rate limit: 10 submissions/hour per IP (hashed; no raw IP persisted).
  const ipHash = createHash('sha256').update(clientIp(request)).digest('hex');
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await sb
    .from('partner_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('submitter_ip_hash', ipHash)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });

  const { error } = await sb.from('partner_referrals').insert({
    org_id: partner.org_id,
    partner_id: partner.id,
    lo_id: partner.added_by,
    borrower_first_name: first.slice(0, 120),
    borrower_last_name: last.slice(0, 120),
    borrower_email: b.borrower_email ? b.borrower_email.toString().trim().slice(0, 200) : null,
    borrower_phone: b.borrower_phone ? b.borrower_phone.toString().trim().slice(0, 40) : null,
    buying_timeline: b.buying_timeline ? b.buying_timeline.toString().slice(0, 80) : null,
    referral_notes: b.referral_notes ? b.referral_notes.toString().slice(0, 2000) : null,
    referral_source: 'link',
    submitter_ip_hash: ipHash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump the partner's lifetime referral counter.
  const { data: cur } = await sb.from('referral_partners').select('referral_count').eq('id', partner.id).maybeSingle();
  await sb.from('referral_partners').update({ referral_count: ((cur?.referral_count as number) ?? 0) + 1 }).eq('id', partner.id);

  // Alert the LO — in-app always.
  const borrowerName = `${first} ${last}`;
  const partnerName = `${partner.first_name} ${partner.last_name}`;
  if (partner.added_by) {
    await notify(sb, {
      orgId: partner.org_id as string,
      userId: partner.added_by as string,
      type: 'system',
      title: `New referral from ${partnerName}`,
      body: `${borrowerName} was referred to you${b.buying_timeline ? ` · ${b.buying_timeline}` : ''}.`,
      link: '/partners',
      urgency: 2,
    });

    // SMS to the LO's own line (internal alert, not a consumer) — Twilio-gated.
    if (twilioConfigured()) {
      const { data: lo } = await sb.from('profiles').select('phone').eq('id', partner.added_by as string).maybeSingle();
      if (lo?.phone) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
          await client.messages.create({
            body: `New referral from ${partnerName}: ${borrowerName}. View in AshleyIQ → Partners.`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: lo.phone as string,
          });
        } catch {
          /* best-effort alert */
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
