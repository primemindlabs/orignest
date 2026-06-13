// Phase 120 — submit a deal-desk request to the lender AE (generates magic-link, emails AE if configured).
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDealDeskToken } from '@/lib/dealDesk/token';
import { notifyAe } from '@/lib/dealDesk/notifyAe';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { requestId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: req } = await sb
    .from('ae_deal_desk_requests')
    .select('*')
    .eq('id', params.requestId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['draft', 'submitted', 'in_review'].includes(req.status as string)) {
    return NextResponse.json({ error: `Cannot submit a ${req.status} request` }, { status: 409 });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await sb
    .from('ae_deal_desk_requests')
    .update({ status: 'submitted', submitted_at: now.toISOString(), expires_at: expires.toISOString(), updated_at: now.toISOString() })
    .eq('id', params.requestId)
    .eq('org_id', orgId);

  // LO identity for the AE-facing email + NMLS disclaimer.
  const { data: lo } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('id', req.lo_id as string).maybeSingle();
  const loName = lo ? [lo.first_name, lo.last_name].filter(Boolean).join(' ') || null : null;

  const token = generateDealDeskToken({ request_id: params.requestId, org_id: orgId });
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('host') ?? 'app.ashleyiq.com'}`;
  const respondUrl = `${origin}/deal-desk/respond/${params.requestId}?token=${token}`;

  let emailed = false;
  if (req.ae_email) {
    try {
      const r = await notifyAe({
        to: req.ae_email as string,
        aeName: (req.ae_name as string) ?? null,
        loName,
        loNmls: (lo?.nmls_id as string) ?? null,
        respondUrl,
        request: {
          lender_name: (req.lender_name as string) ?? null,
          loan_type: (req.loan_type as string) ?? null,
          loan_amount: (req.loan_amount as number) ?? null,
          ltv: (req.ltv as number) ?? null,
          fico_score: (req.fico_score as number) ?? null,
          loan_purpose: (req.loan_purpose as string) ?? null,
          occupancy: (req.occupancy as string) ?? null,
          requested_rate: (req.requested_rate as number) ?? null,
          requested_price: (req.requested_price as number) ?? null,
          lock_period_days: (req.lock_period_days as number) ?? null,
          exception_reason: (req.exception_reason as string) ?? null,
        },
      });
      emailed = r.sent;
    } catch {
      emailed = false; // record-only fallback; LO can copy the link manually
    }
  }

  await sb.from('ae_deal_desk_messages').insert({
    request_id: params.requestId,
    org_id: orgId,
    sender_type: 'system',
    body: emailed
      ? `Request submitted to ${req.ae_name ?? 'the AE'} at ${req.ae_email}.`
      : `Request marked submitted. ${req.ae_email ? 'Email delivery is not configured — share the AE link manually.' : 'No AE email on file — share the AE link manually.'}`,
  });

  return NextResponse.json({ ok: true, emailed, respondUrl });
}
