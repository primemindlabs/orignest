/**
 * GET /api/settings/los/arive-debug — admin diagnostic. Calls Arive's endpoints
 * with the org's STORED key and returns the raw status/headers/body so we can see
 * exactly why lists come back empty (auth vs scope vs response shape). Never
 * returns the API key itself. Temporary debugging aid.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { getLosConnection, getLosCredentials } from '@/lib/los/connection';
import { ariveBase } from '@/lib/los/arive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ADMIN = ['admin', 'branch_manager'];

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
    return {
      path,
      status: res.status,
      contentType: res.headers.get('content-type'),
      server: res.headers.get('server') ?? res.headers.get('x-powered-by') ?? null,
      shape,
      bodySnippet: text.slice(0, 1200),
    };
  } catch (e) {
    return { path, error: (e as Error).message };
  }
}

export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  const creds = await getLosCredentials(orgId, 'arive').catch(() => null);
  const conn = await getLosConnection(orgId, 'arive');
  const base = ariveBase(conn?.base_url);
  if (!creds?.apiKey || !base) {
    return NextResponse.json({ error: 'No Arive connection', base, hasKey: !!creds?.apiKey });
  }

  const probes = await Promise.all([
    probe(base, creds.apiKey, '/api/hooks'),
    probe(base, creds.apiKey, '/api/loans'),
    probe(base, creds.apiKey, '/api/loans?limit=2&offset=0&orderBy=updatedAt&sort=DESC'),
    probe(base, creds.apiKey, '/api/leads'),
    probe(base, creds.apiKey, '/api/leads?limit=2'),
  ]);

  return NextResponse.json({ base, storedKeyLength: creds.apiKey.length, probes }, { status: 200 });
}
