/**
 * GET /api/webhooks/arive-debug?tenant_id=<org>&secret=<webhook_secret>
 *
 * PUBLIC diagnostic (lives under /api/webhooks/* so it's allow-listed past Clerk —
 * the dev Clerk instance 404s hard-navigations to protected routes). Authorized by
 * the org's webhook_secret (same one shown on the Arive card), NOT a login. Calls
 * Arive with the org's stored key and returns raw status/shape/body so we can see
 * why lists come back empty. Never returns the API key. Temporary debugging aid.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { timingSafeEqual } from 'crypto';
import { getLosCredentials } from '@/lib/los/connection';
import { ariveBase } from '@/lib/los/arive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function constantEq(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function probe(base: string, apiKey: string, path: string) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { headers: { 'X-API-KEY': apiKey, Accept: 'application/json' } });
    const text = await res.text().catch(() => '');
    let json: any;
    try { json = JSON.parse(text); } catch { /* not json */ }
    const shape = Array.isArray(json)
      ? `array(length=${json.length})`
      : json && typeof json === 'object'
        ? `object{ ${Object.keys(json).join(', ')} }`
        : 'non-json';
    return { path, status: res.status, contentType: res.headers.get('content-type'), server: res.headers.get('server') ?? res.headers.get('x-powered-by') ?? null, shape, bodySnippet: text.slice(0, 1200) };
  } catch (e) {
    return { path, error: (e as Error).message };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('tenant_id');
  const secret = url.searchParams.get('secret') ?? '';
  if (!orgId) return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });

  const sb = createAdminClient();
  const { data: conn } = await sb.from('los_connections').select('webhook_secret, base_url').eq('org_id', orgId).eq('los_type', 'arive').eq('is_active', true).maybeSingle();
  if (!conn?.webhook_secret) return NextResponse.json({ error: 'No active Arive connection for that tenant_id' }, { status: 404 });
  if (!secret || !constantEq(secret, conn.webhook_secret as string)) return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });

  const creds = await getLosCredentials(orgId, 'arive').catch(() => null);
  const base = ariveBase(conn.base_url);
  if (!creds?.apiKey || !base) return NextResponse.json({ error: 'No stored key / base URL', base, hasKey: !!creds?.apiKey });

  const probes = await Promise.all([
    probe(base, creds.apiKey, '/api/hooks'),
    probe(base, creds.apiKey, '/api/loans?limit=2&offset=0&orderBy=updatedAt&sort=DESC'),
  ]);

  // OAuth test: if clientId + clientSecret are supplied, try /api/auth/login and,
  // if it returns a token, a Bearer'd /api/loans call. Decides X-API-KEY vs OAuth.
  let oauth: any;
  const clientId = url.searchParams.get('clientId');
  const clientSecret = url.searchParams.get('clientSecret');
  if (clientId && clientSecret) {
    const loginUrl = `${base}/api/auth/login`;
    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'X-API-KEY': creds.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ clientId, secret: clientSecret, apiKey: creds.apiKey }),
      });
      const text = await res.text().catch(() => '');
      let json: any; try { json = JSON.parse(text); } catch { /* */ }
      const token = json?.AccessToken ?? json?.accessToken ?? json?.access_token;
      oauth = { loginStatus: res.status, loginContentType: res.headers.get('content-type'), loginBody: text.slice(0, 800), gotToken: !!token };
      if (token) {
        const lr = await fetch(`${base}/api/loans?limit=2&orderBy=updatedAt&sort=DESC`, { headers: { Authorization: `Bearer ${token}`, 'X-API-KEY': creds.apiKey, Accept: 'application/json' } });
        const lt = await lr.text().catch(() => '');
        oauth.bearerLoans = { status: lr.status, contentType: lr.headers.get('content-type'), bodySnippet: lt.slice(0, 800) };
      }
    } catch (e) {
      oauth = { error: (e as Error).message };
    }
  } else {
    oauth = 'Pass &clientId=...&clientSecret=... to test the OAuth login flow.';
  }

  return NextResponse.json({ base, storedKeyLength: creds.apiKey.length, probes, oauth }, { status: 200 });
}
