/**
 * Facebook Login (OAuth) + Page subscription helpers for self-serve Lead Ads setup.
 * SERVER-ONLY. The customer clicks "Connect Facebook", authorizes, and we exchange the
 * code for a long-lived user token, list their Pages (each with its own long-lived
 * Page token), and subscribe the chosen Page(s) to our app's `leadgen` webhook — no
 * manual token copy-paste.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

const GRAPH = `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? 'v21.0'}`;
const SCOPES = ['pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'leads_retrieval', 'business_management'];

export function isOAuthConfigured(): boolean {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

export function callbackUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/integrations/facebook/oauth/callback`;
}

// ── Signed CSRF state carrying the org id through the redirect ──────────────────
function stateSecret(): string {
  return process.env.FACEBOOK_APP_SECRET || process.env.UNSUBSCRIBE_TOKEN_SECRET || 'fb-oauth-dev-only';
}
function b64url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function signState(orgId: string): string {
  const body = b64url(JSON.stringify({ o: orgId, exp: Math.floor(Date.now() / 1000) + 600 }));
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verifyState(state: string | null): string | null {
  if (!state) return null;
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { o: string; exp: number };
    if (!p.o || (p.exp && p.exp < Math.floor(Date.now() / 1000))) return null;
    return p.o;
  } catch { return null; }
}

export function getLoginUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID ?? '',
    redirect_uri: callbackUrl(),
    state,
    scope: SCOPES.join(','),
    response_type: 'code',
  });
  return `https://www.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? 'v21.0'}/dialog/oauth?${params}`;
}

/** code → short-lived user token → long-lived user token. Throws on failure. */
export async function exchangeCodeForLongLivedToken(code: string): Promise<string> {
  const id = process.env.FACEBOOK_APP_ID!;
  const secret = process.env.FACEBOOK_APP_SECRET!;

  const shortRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({ client_id: id, redirect_uri: callbackUrl(), client_secret: secret, code }));
  const shortJson = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || !shortJson.access_token) throw new Error(shortJson?.error?.message ?? `Token exchange failed (${shortRes.status})`);

  const longRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: id, client_secret: secret, fb_exchange_token: shortJson.access_token }));
  const longJson = await longRes.json().catch(() => ({}));
  if (!longRes.ok || !longJson.access_token) throw new Error(longJson?.error?.message ?? 'Long-lived token exchange failed');
  return longJson.access_token as string;
}

export interface ManagedPage { id: string; name: string; access_token: string }

/** Pages the authorizing user manages, each with its own (long-lived) Page token. */
export async function listManagedPages(userToken: string): Promise<ManagedPage[]> {
  const out: ManagedPage[] = [];
  let url: string | null = `${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`;
  for (let guard = 0; url && guard < 10; guard++) {
    const res: Response = await fetch(url, { cache: 'no-store' });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? `Could not list Pages (${res.status})`);
    for (const p of json.data ?? []) if (p?.id && p?.access_token) out.push({ id: String(p.id), name: String(p.name ?? ''), access_token: String(p.access_token) });
    url = json.paging?.next ?? null;
  }
  return out;
}

/** Subscribe a Page to our app's `leadgen` webhook. Best-effort: returns {ok,error}. */
export async function subscribePageToLeadgen(pageId: string, pageToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ subscribed_fields: 'leadgen', access_token: pageToken }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) return { ok: false, error: (json as any)?.error?.message ?? `Subscribe failed (${res.status})` };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Remove our app's subscription from a Page. Best-effort. */
export async function unsubscribePage(pageId: string, pageToken: string): Promise<void> {
  try {
    await fetch(`${GRAPH}/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`, { method: 'DELETE' });
  } catch { /* best-effort */ }
}
