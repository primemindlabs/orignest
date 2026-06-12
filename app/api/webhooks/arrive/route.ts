/**
 * Phase 94 — Arrive (arrive.app) relocation-concierge inbound webhook.
 *
 * Per-LO routing via ?lo=<profiles.id> (each LO has their own Arrive partner
 * account). HMAC-SHA256 verify against the LO's webhook_secret, then create the
 * loan stub + welcome email. Always 200s on inactive/missing/duplicate so Arrive
 * does not retry-storm. NOTE: distinct from the Phase 41 "arive" LOS webhook.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyArriveSignature } from '@/lib/arrive/signature';
import { importArriveLead, type ArriveLead } from '@/lib/arrive/importLead';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const loId = url.searchParams.get('lo');
  if (!loId) return new NextResponse('Missing lo', { status: 400 });

  const body = await req.text();
  const sb = createAdminClient();

  const { data: integ } = await sb
    .from('arrive_integrations')
    .select('lo_id, org_id, webhook_secret, is_active')
    .eq('lo_id', loId)
    .maybeSingle();

  // Silently accept when not connected/inactive — avoids leaking config state and
  // stops Arrive from retrying against a disabled endpoint.
  if (!integ || !integ.is_active) return new NextResponse('OK', { status: 200 });

  const signature = req.headers.get('x-arrive-signature') ?? '';
  if (!verifyArriveSignature(body, signature, integ.webhook_secret ?? '')) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  let payload: ArriveLead;
  try {
    payload = JSON.parse(body) as ArriveLead;
  } catch {
    return new NextResponse('Bad JSON', { status: 400 });
  }
  if (!payload?.leadId || !payload?.email) return new NextResponse('OK', { status: 200 });

  // Dedup at the application layer (UNIQUE(arrive_lead_id) is the DB backstop).
  // A repeat delivery is a no-op: the original imported row is the record.
  const { data: existing } = await sb
    .from('arrive_lead_imports')
    .select('id')
    .eq('arrive_lead_id', payload.leadId)
    .maybeSingle();
  if (existing) return new NextResponse('OK', { status: 200 });

  await importArriveLead(payload, { lo_id: integ.lo_id, org_id: integ.org_id });
  return new NextResponse('OK', { status: 200 });
}
