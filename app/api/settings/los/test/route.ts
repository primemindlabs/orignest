// POST /api/settings/los/test — validate stored LOS credentials by performing a
// real auth handshake (token exchange), without mutating anything. Admin only.
//
// Lets an admin confirm Client ID / Secret / Gateway URL are correct up front,
// instead of discovering a typo on the first real sync. Receive-only push LOS
// (BytePro) have no outbound credentials to test.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { getLosConnection, getLosCredentials, type LosType } from '@/lib/los/connection';
import { ariveBase, getAriveToken } from '@/lib/los/ariveAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ADMIN = ['admin', 'branch_manager'];
const TESTABLE: LosType[] = ['arive', 'lendingpad'];

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can test an LOS connection.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { los_type?: string };
  const losType = b.los_type as LosType;
  if (!TESTABLE.includes(losType)) {
    return NextResponse.json({ ok: false, error: 'This connection is receive-only (webhook) — nothing to test outbound.' }, { status: 400 });
  }

  let creds: { apiKey: string; apiSecret: string | null } | null;
  try {
    creds = await getLosCredentials(orgId, losType);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Stored credentials couldn't be read — re-enter them. ${(e as Error).message}` });
  }
  if (!creds) return NextResponse.json({ ok: false, error: 'No active connection — save credentials first.' });

  try {
    if (losType === 'arive') {
      const conn = await getLosConnection(orgId, 'arive');
      const auth = await getAriveToken(ariveBase(conn?.base_url), creds.apiKey, creds.apiSecret);
      if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error });
      return NextResponse.json({ ok: true, message: 'Arive authenticated — credentials are valid.' });
    }
    // lendingpad: same client-credentials exchange used in lib/los/syncLoan.
    const tok = await fetch('https://api.lendingpad.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.apiKey, client_secret: creds.apiSecret ?? '', scope: 'loans:read' }),
    });
    if (!tok.ok) {
      const snippet = (await tok.text().catch(() => '')).slice(0, 200);
      return NextResponse.json({ ok: false, error: `LendingPad auth failed (${tok.status}). ${snippet}`.trim() });
    }
    const { access_token } = await tok.json().catch(() => ({}));
    if (!access_token) return NextResponse.json({ ok: false, error: 'LendingPad auth returned no access_token.' });
    return NextResponse.json({ ok: true, message: 'LendingPad authenticated — credentials are valid.' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Could not reach the LOS: ${(e as Error).message}` });
  }
}
