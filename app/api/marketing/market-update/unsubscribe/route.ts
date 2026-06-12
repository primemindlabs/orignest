/**
 * Phase 100 — public realtor unsubscribe (GET, no auth — the unguessable ids in
 * the link are the credential). Sets the realtor's market-update opt-out and
 * stamps the send row, then returns a small confirmation page.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function page(message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,sans-serif;background:#FAFAF8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:40px;max-width:420px;text-align:center;">
<div style="font-size:32px;">✓</div>
<h1 style="font-size:18px;color:#111827;margin:12px 0 6px;">You're unsubscribed</h1>
<p style="font-size:14px;color:#6B7280;margin:0;">${message}</p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const realtorId = url.searchParams.get('realtor');
  const updateId = url.searchParams.get('update');
  if (!realtorId) return page('Invalid link.');

  const sb = createAdminClient();
  await sb.from('realtors').update({ unsubscribed_market_update: true }).eq('id', realtorId).then(() => undefined, () => undefined);
  if (updateId) {
    await sb.from('realtor_market_update_sends')
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq('update_id', updateId).eq('realtor_id', realtorId)
      .then(() => undefined, () => undefined);
  }
  return page("You won't receive any more weekly market update emails. You can ask your loan officer to re-add you anytime.");
}
