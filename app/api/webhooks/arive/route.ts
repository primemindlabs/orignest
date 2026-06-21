/**
 * Arive (LOS) inbound webhook — Zapier model.
 *
 * Arive has no public REST API; brokers push loan data to us by building a Zap
 * (Arive trigger → "Webhooks by Zapier" POST) that hits this endpoint. So we
 * process the POSTED BODY directly — there is nothing to fetch back from Arive.
 *
 * Tenant + auth: the URL carries ?tenant_id=<org>; the org's webhook_secret is
 * supplied by the Zap either as ?secret=… / ?token=… or an X-Webhook-Secret
 * (or `Authorization: Bearer …`) header. An optional x-arive-signature HMAC of
 * the body is also accepted, for any native (non-Zapier) push. Inert (200) when
 * the tenant isn't connected or the secret doesn't match.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac, timingSafeEqual } from 'crypto';
import { matchOrCreateLead } from '@/lib/los/syncLoan';
import { mapLosStatus } from '@/lib/los/statusMap';
import { logSyncEvent } from '@/lib/los/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function constantEq(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function hmacMatches(secret: string, raw: string, sig: string): boolean {
  if (!sig) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  return constantEq(expected, sig) || constantEq(`sha256=${expected}`, sig);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('tenant_id');
  if (!orgId) return new NextResponse('Missing tenant_id', { status: 400 });

  const body = await req.text();
  const sb = createAdminClient();
  const { data: conn } = await sb.from('los_connections').select('webhook_secret').eq('org_id', orgId).eq('los_type', 'arive').eq('is_active', true).maybeSingle();
  if (!conn?.webhook_secret) return NextResponse.json({ received: true, ignored: 'arive not connected' }, { status: 200 });
  const secret = conn.webhook_secret as string;

  // Accept the secret from query (?secret=/?token=), a header, or an HMAC of the body.
  const headerSecret = req.headers.get('x-webhook-secret') ?? (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const querySecret = url.searchParams.get('secret') ?? url.searchParams.get('token') ?? '';
  const provided = headerSecret || querySecret;
  const authed = (!!provided && constantEq(provided, secret)) || hmacMatches(secret, body, req.headers.get('x-arive-signature') ?? '');
  if (!authed) return new NextResponse('Invalid secret', { status: 401 });

  let payload: Record<string, any>;
  try { payload = JSON.parse(body); } catch { return new NextResponse('Bad JSON', { status: 400 }); }

  // Zapier posts either a wrapped event ({event, loan, loanId}) or the loan fields
  // flat at the top level — accept both.
  const loan: Record<string, any> = (payload.loan && typeof payload.loan === 'object') ? payload.loan : payload;
  const loanId = String(payload.loanId ?? loan.id ?? loan.loanId ?? loan.loanNumber ?? loan.loan_number ?? '').trim();
  if (!loanId) {
    await logSyncEvent({ orgId, losType: 'arive', eventType: 'webhook', direction: 'inbound', result: 'skipped', error: 'no loan id in payload' });
    return NextResponse.json({ received: true, ignored: 'no loan id' }, { status: 200 });
  }

  try {
    const leadId = await matchOrCreateLead(orgId, loan, 'arive', loanId);
    const rawStatus = String(loan.status ?? loan.loanStatus ?? loan.milestone ?? payload.status ?? '').trim();
    const stage = rawStatus ? mapLosStatus('arive', rawStatus) : null;
    if (leadId && stage) {
      // LOS is the system of record — apply its stage authoritatively.
      await sb.from('leads').update({ stage, los_loan_id: loanId, los_type: 'arive', los_last_synced_at: new Date().toISOString() }).eq('id', leadId).eq('org_id', orgId);
    }
    await sb.from('los_connections').update({ last_sync_at: new Date().toISOString(), sync_error: null }).eq('org_id', orgId).eq('los_type', 'arive');
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: loanId, eventType: String(payload.event ?? payload.eventType ?? 'webhook'), direction: 'inbound', payload: { stage }, result: 'success' });
  } catch (e) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: loanId, eventType: 'sync_error', direction: 'inbound', result: 'error', error: String(e) });
  }
  return NextResponse.json({ received: true });
}
