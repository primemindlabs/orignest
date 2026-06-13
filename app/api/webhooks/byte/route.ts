/**
 * Phase 117 — BytePro LOS webhook. Mirrors the Phase 41/56 LendingPad/Arive/Encompass
 * pattern. Receive-only (LOS → Ashley IQ): maps the BytePro numeric status onto the
 * lead's stage. ADDITIVE — only updates a loan we already track; never inserts/deletes,
 * never overwrites other fields. INERT until a tenant has an active `byte` connection.
 *
 * The tenant is resolved by HMAC-matching the body against each active byte
 * connection's webhook_secret (so the LO pastes one URL, no enumerable id in it).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac, timingSafeEqual } from 'crypto';
import { mapLosStatus } from '@/lib/los/statusMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sigMatches(secret: string, raw: string, provided: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-webhook-signature') ?? req.headers.get('x-byte-signature') ?? '';

  const sb = createAdminClient();
  const { data: conns } = await sb
    .from('los_connections')
    .select('org_id, webhook_secret')
    .eq('los_type', 'byte')
    .eq('is_active', true);

  // Resolve tenant by signature. No active byte connection → inert (200).
  const conn = (conns ?? []).find((c) => c.webhook_secret && sig && sigMatches(c.webhook_secret as string, raw, sig));
  if (!conn) return NextResponse.json({ received: true, ignored: 'no matching byte connection / signature' }, { status: 200 });

  let event: { eventType?: string; loanNumber?: string; loan_number?: string; status?: string | number; loanStatus?: string | number };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: true, ignored: 'bad payload' }, { status: 200 });
  }

  const losLoanNumber = String(event.loanNumber ?? event.loan_number ?? '').trim();
  const losStatus = String(event.status ?? event.loanStatus ?? '').trim();
  const stage = losStatus ? mapLosStatus('byte', losStatus) : null;

  if (stage && losLoanNumber) {
    // Additive: only move a loan we already track (never insert; merge, not overwrite).
    await sb
      .from('leads')
      .update({ stage, los_last_synced_at: new Date().toISOString() })
      .eq('org_id', conn.org_id)
      .eq('los_type', 'byte')
      .eq('los_loan_id', losLoanNumber)
      .then(() => undefined, () => undefined);
  }

  await sb
    .from('los_sync_events')
    .insert({
      org_id: conn.org_id,
      los_type: 'byte',
      los_loan_id: losLoanNumber || null,
      event_type: 'status_changed',
      direction: 'inbound',
      payload: { event_type: event.eventType ?? null, status: losStatus, stage },
      result: stage ? 'success' : 'ignored',
    })
    .then(() => undefined, () => undefined);

  return NextResponse.json({ received: true });
}
