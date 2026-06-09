/**
 * Phase 41.3 — LendingPad inbound webhook. One endpoint per tenant via ?tenant_id=.
 * Verifies HMAC-SHA256 signature against the org's stored webhook_secret, then
 * dispatches to the (gated) loan sync. Inert until a real LendingPad account is
 * connected and sends events.
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
  const { data: conn } = await sb.from('los_connections').select('webhook_secret').eq('org_id', orgId).eq('los_type', 'lendingpad').eq('is_active', true).maybeSingle();
  if (!conn) return new NextResponse('Not connected', { status: 404 });

  const signature = req.headers.get('x-lendingpad-signature') ?? '';
  if (!verify(body, signature, conn.webhook_secret ?? '')) return new NextResponse('Invalid signature', { status: 401 });

  let event: any;
  try { event = JSON.parse(body); } catch { return new NextResponse('Bad JSON', { status: 400 }); }

  try {
    switch (event.eventType) {
      case 'loan.created':
        if (event.loan) await matchOrCreateLead(orgId, event.loan, 'lendingpad', event.loanId);
        break;
      case 'loan.status.changed':
      case 'loan.condition.added':
      case 'loan.condition.cleared':
      case 'loan.contact.updated':
      case 'loan.closed':
        if (event.loanId) await syncLoanFromLos(orgId, 'lendingpad', event.loanId);
        break;
    }
  } catch (e) {
    await logSyncEvent({ orgId, losType: 'lendingpad', losLoanId: event.loanId, eventType: 'sync_error', direction: 'inbound', result: 'error', error: String(e) });
  }
  return NextResponse.json({ received: true });
}
