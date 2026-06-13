// Phase 120 — PUBLIC AE response endpoint. Token-gated (HMAC magic-link), no login.
// Allowlisted in middleware. The AE submits offered pricing for one request.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyDealDeskToken } from '@/lib/dealDesk/token';

export const dynamic = 'force-dynamic';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const token = (b.token ?? '').toString();
  const requestId = (b.requestId ?? '').toString();

  const payload = verifyDealDeskToken(token);
  if (!payload || payload.request_id !== requestId) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: req } = await sb
    .from('ae_deal_desk_requests')
    .select('id, org_id, status, ae_name')
    .eq('id', requestId)
    .eq('org_id', payload.org_id)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (['approved', 'declined', 'expired'].includes(req.status as string)) {
    return NextResponse.json({ error: 'This request is closed.' }, { status: 409 });
  }

  const offeredRate = num(b.ae_offered_rate);
  const offeredPrice = num(b.ae_offered_price);
  const responseNotes = b.ae_response_notes ? b.ae_response_notes.toString().slice(0, 2000) : null;
  if (offeredRate == null && offeredPrice == null && !responseNotes) {
    return NextResponse.json({ error: 'Provide a rate, price, or note.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  await sb
    .from('ae_deal_desk_requests')
    .update({
      ae_offered_rate: offeredRate,
      ae_offered_price: offeredPrice,
      ae_response_notes: responseNotes,
      ae_responded_at: now,
      status: 'responded',
      updated_at: now,
    })
    .eq('id', requestId)
    .eq('org_id', payload.org_id);

  const parts: string[] = [];
  if (offeredRate != null) parts.push(`Rate ${offeredRate}%`);
  if (offeredPrice != null) parts.push(`Price ${offeredPrice}`);
  if (responseNotes) parts.push(responseNotes);
  await sb.from('ae_deal_desk_messages').insert({
    request_id: requestId,
    org_id: payload.org_id,
    sender_type: 'ae',
    sender_name: (req.ae_name as string) ?? 'Account Executive',
    body: parts.join(' · ') || 'Responded',
  });

  return NextResponse.json({ ok: true });
}
