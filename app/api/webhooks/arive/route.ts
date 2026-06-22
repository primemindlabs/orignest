/**
 * Arive (LOS) inbound webhook.
 *
 * Arive fires native hook subscriptions we register via POST /api/hooks/subscribe
 * (see lib/los/arive). A fired hook carries only an id + event type; we then call
 * Get Loan / Get Lead to fetch the authoritative record (lib/los/ariveSync).
 *
 * Auth: the subscription has no secret of its own, but WE registered the callback
 * URL, so we embed our per-org webhook_secret in it (?tenant_id=&secret=). Also
 * accepts the secret via X-Webhook-Secret / Bearer header. Inert (200) when the
 * tenant isn't connected.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { timingSafeEqual } from 'crypto';
import { syncAriveEntity } from '@/lib/los/ariveSync';
import { logSyncEvent } from '@/lib/los/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function constantEq(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('tenant_id');
  if (!orgId) return new NextResponse('Missing tenant_id', { status: 400 });

  const body = await req.text();
  const sb = createAdminClient();
  const { data: conn } = await sb.from('los_connections').select('webhook_secret').eq('org_id', orgId).eq('los_type', 'arive').eq('is_active', true).maybeSingle();
  if (!conn?.webhook_secret) return NextResponse.json({ received: true, ignored: 'arive not connected' }, { status: 200 });

  const provided = (req.headers.get('x-webhook-secret') ?? (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
    || url.searchParams.get('secret') || url.searchParams.get('token') || '';
  if (!provided || !constantEq(provided, conn.webhook_secret as string)) return new NextResponse('Invalid secret', { status: 401 });

  let p: Record<string, any>;
  try { p = JSON.parse(body); } catch { return new NextResponse('Bad JSON', { status: 400 }); }

  // The hook body carries an id + event type; field casing isn't documented, so be liberal.
  const event = String(p.event ?? p.Event ?? p.eventType ?? p.EventName ?? p.eventName ?? '').toUpperCase();
  const id = String(p.id ?? p.Id ?? p.loanId ?? p.LoanId ?? p.leadId ?? p.LeadId ?? p.sysGUID ?? p.sysGuid ?? '').trim();
  if (!event || !id) {
    await logSyncEvent({ orgId, losType: 'arive', eventType: 'webhook', direction: 'inbound', result: 'skipped', error: `missing id/event (event=${event || '?'}, id=${id || '?'})` });
    return NextResponse.json({ received: true, ignored: 'missing id/event' }, { status: 200 });
  }

  const kind: 'loan' | 'lead' = event.startsWith('LEAD') ? 'lead' : 'loan';
  try {
    await syncAriveEntity(orgId, kind, id);
  } catch (e) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: id, eventType: 'sync_error', direction: 'inbound', result: 'error', error: String(e) });
  }
  return NextResponse.json({ received: true });
}
