/**
 * Facebook / Instagram Lead Ads webhook.
 *   GET  → Meta subscription handshake (hub.challenge / hub.verify_token).
 *   POST → leadgen events. Verifies X-Hub-Signature-256, routes each event by Page id
 *          to the connected org, and imports the lead IMMEDIATELY (Graph API pull +
 *          loan-stub create) inside the request. Always 200s on benign cases so Meta
 *          does not retry-storm.
 *
 * Setup: subscribe the app's `leadgen` Page webhook to {APP_URL}/api/webhooks/facebook
 * with FACEBOOK_VERIFY_TOKEN; sign with FACEBOOK_APP_SECRET. Connect each Page (Page id
 * + long-lived Page access token) under Settings → Integrations.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import { verifyMetaSignature } from '@/lib/facebook/signature';
import { importFacebookLead, type FbLeadValue } from '@/lib/facebook/importLead';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = process.env.FACEBOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && expected && token === expected) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), process.env.FACEBOOK_APP_SECRET ?? '')) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return new NextResponse('Bad JSON', { status: 400 }); }
  if (body?.object !== 'page') return new NextResponse('OK', { status: 200 });

  const sb = createAdminClient();
  const tasks: Promise<unknown>[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change?.field !== 'leadgen') continue;
      const v = (change.value ?? {}) as Record<string, any>;
      const pageId = String(v.page_id ?? entry.id ?? '');
      const leadgenId = v.leadgen_id != null ? String(v.leadgen_id) : null;
      if (!pageId || !leadgenId) continue;

      const { data: conn } = await sb
        .from('facebook_lead_connections')
        .select('id, org_id, lo_id, page_id, page_access_token_enc, is_active')
        .eq('page_id', pageId).eq('is_active', true).limit(1).maybeSingle();
      if (!conn) continue; // Page not connected to any org — ignore (no retry storm).

      let pageToken: string;
      try { pageToken = decrypt(conn.page_access_token_enc); } catch { continue; }

      const value: FbLeadValue = { leadgen_id: leadgenId, form_id: v.form_id != null ? String(v.form_id) : undefined, page_id: pageId, created_time: v.created_time };
      tasks.push(importFacebookLead(value, { connectionId: conn.id, org_id: conn.org_id, lo_id: conn.lo_id, page_id: conn.page_id, pageToken }));
    }
  }

  await Promise.allSettled(tasks);
  return new NextResponse('OK', { status: 200 });
}
