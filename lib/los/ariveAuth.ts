/**
 * Arive (LOS) authentication — OAuth2 client-credentials. SERVER-ONLY.
 *
 * Arive's partner API gateway issues a Client ID + Secret Key from
 * Arive → Settings → Integrations. Requests authenticate by exchanging those for
 * a short-lived bearer token (grant_type=client_credentials), then calling the
 * gateway with `Authorization: Bearer <token>`. This mirrors the LendingPad flow
 * in lib/los/syncLoan.ts.
 *
 * The gateway base is whatever the admin entered as "API Gateway URL" on the
 * connect form (los_connections.base_url); the token endpoint follows the base by
 * the standard `/oauth/token` convention. Both URLs are surfaced verbatim in error
 * messages so a wrong path is obvious from the sync result.
 */
import 'server-only';

/** Resolve the Arive gateway base, trimming any trailing slash. */
export function ariveBase(baseUrl?: string | null): string {
  return (baseUrl || 'https://api.arive.com/v1').replace(/\/+$/, '');
}

/** Exchange Client ID + Secret for a bearer token. Returns the token or a legible error. */
export async function getAriveToken(
  base: string,
  clientId: string,
  clientSecret: string | null,
): Promise<{ token: string } | { error: string }> {
  if (!clientSecret) {
    return { error: 'Arive needs both a Client ID and a Secret Key — re-enter both in Settings → Integrations.' };
  }
  const tokenUrl = `${base}/oauth/token`;
  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
  } catch (e) {
    return { error: `Could not reach Arive token endpoint at ${tokenUrl}: ${(e as Error).message}` };
  }
  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 200);
    return { error: `Arive auth failed (${res.status}) at ${tokenUrl}. ${snippet}`.trim() };
  }
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = j.access_token ?? j.accessToken ?? j.token;
  if (!token) return { error: `Arive auth succeeded but returned no access_token at ${tokenUrl}.` };
  return { token: String(token) };
}
