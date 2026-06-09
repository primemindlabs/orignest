/**
 * Phase 38.2 — one-click unsubscribe (public, token-gated, no login).
 * GET /api/unsubscribe?token=... → record opt-out + return a simple HTML page.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribeToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function page(message: string, ok: boolean): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head>
  <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F5F7;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;">
    <div style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:32px 40px;max-width:420px;text-align:center;">
      <div style="font-size:26px;margin-bottom:8px;">${ok ? '✓' : '⚠️'}</div>
      <p style="font-size:15px;color:#1D1D1F;margin:0 0 6px;font-weight:600;">${ok ? 'You\'ve been unsubscribed' : 'Link expired'}</p>
      <p style="font-size:13px;color:#6E6E73;margin:0;">${message}</p>
    </div>
  </body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const payload = verifyUnsubscribeToken(token);
  if (!payload) return page('This unsubscribe link is invalid or has expired. Reply STOP to any message to opt out.', false);

  const sb = createAdminClient();
  await sb.from('email_unsubscribes').upsert(
    { org_id: payload.org_id, email: payload.email.toLowerCase(), lead_id: payload.lead_id ?? null, source: 'one_click' },
    { onConflict: 'org_id,email', ignoreDuplicates: true }
  ).then(() => undefined, () => undefined);

  // Flag the lead(s) with this email in the org.
  const q = sb.from('leads').update({ email_opt_out: true, unsubscribed_email: true, unsubscribed_at: new Date().toISOString() }).ilike('email', payload.email);
  if (payload.org_id) await q.eq('org_id', payload.org_id);
  else await q;

  return page("You won't receive any more marketing emails. Transactional messages about an active loan may still be sent.", true);
}
