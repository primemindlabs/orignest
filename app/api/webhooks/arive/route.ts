/**
 * Phase 41.4 — Arive inbound webhook. Same pattern as LendingPad: per-tenant via
 * ?tenant_id=, HMAC-SHA256 signature verify, dispatch to the (gated) sync.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac, timingSafeEqual } from 'crypto';
import { syncLoanFromLos, matchOrCreateLead } from '@/lib/los/syncLoan';
import { logSyncEvent } from '@/lib/los/connection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verify(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const orgId = new URL(req.url).searchParams.get('tenant_id');
  if (!orgId) return new NextResponse('Missing tenant_id', { status: 400 });

  const body = await req.text();
  const sb = createAdminClient();
  const { data: conn } = await sb.from('los_connections').select('webhook_secret').eq('org_id', orgId).eq('los_type', 'arive').eq('is_active', true).maybeSingle();
  if (!conn) return new NextResponse('Not connected', { status: 404 });

  const signature = req.headers.get('x-arive-signature') ?? '';
  if (!verify(body, signature, conn.webhook_secret ?? '')) return new NextResponse('Invalid signature', { status: 401 });

  let event: any;
  try { event = JSON.parse(body); } catch { return new NextResponse('Bad JSON', { status: 400 }); }

  try {
    switch (event.event ?? event.eventType) {
      case 'loan.created':
        if (event.loan) await matchOrCreateLead(orgId, event.loan, 'arive', event.loanId);
        break;
      case 'loan.statusUpdated':
      case 'loan.conditionAdded':
      case 'loan.conditionCleared':
      case 'loan.closed':
      case 'loan.withdrawn':
        if (event.loanId) await syncLoanFromLos(orgId, 'arive', event.loanId);
        break;
    }
  } catch (e) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: event.loanId, eventType: 'sync_error', direction: 'inbound', result: 'error', error: String(e) });
  }
  return NextResponse.json({ received: true });
}
