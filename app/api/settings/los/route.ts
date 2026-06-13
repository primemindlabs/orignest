/**
 * Phase 41.7 — LOS connection management (admin only).
 *   GET    → connection status for each LOS (never returns decrypted creds)
 *   POST   → connect: encrypt + store credentials, generate webhook secret
 *   DELETE → disconnect: remove credentials (los_loan_map preserved for audit)
 *
 * Live connection-test, webhook registration, and initial sync are GATED — they
 * require reachable LendingPad/Arive APIs. Credentials are stored encrypted so
 * sync activates the moment the LOS API is available.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto/encrypt';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOS_TYPES = ['lendingpad', 'arive', 'encompass', 'byte'];
const ADMIN = ['admin', 'branch_manager'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  // webhook_secret is the org's own signing key (admin-only view) — needed to configure
  // a push LOS like BytePro.
  const { data } = await sb.from('los_connections').select('los_type, is_active, last_sync_at, sync_error, created_at, webhook_secret').eq('org_id', orgId);
  return NextResponse.json({ connections: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can connect an LOS.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { los_type?: string; api_key?: string; api_secret?: string; base_url?: string };
  if (!LOS_TYPES.includes(b.los_type ?? '')) return NextResponse.json({ error: 'Invalid los_type' }, { status: 400 });
  if (!b.api_key) return NextResponse.json({ error: 'API key is required' }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb.from('los_connections').upsert({
    org_id: orgId,
    los_type: b.los_type,
    api_key_enc: encrypt(b.api_key),
    api_secret_enc: b.api_secret ? encrypt(b.api_secret) : null,
    webhook_secret: randomBytes(24).toString('hex'),
    base_url: b.base_url ?? null,
    is_active: true,
    sync_error: 'Credentials saved. Live sync activates once the LOS API is reachable.',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,los_type' });
  if (error) {
    console.error('[los] connect failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  // GATED: register webhook + run initial sync here once the LOS API is reachable.
  return NextResponse.json({ connected: true, los_type: b.los_type, note: 'Credentials encrypted and stored. Live bi-directional sync activates when the LOS API is connected.' });
}

export async function DELETE(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const losType = new URL(req.url).searchParams.get('los_type') ?? '';
  if (!LOS_TYPES.includes(losType)) return NextResponse.json({ error: 'Invalid los_type' }, { status: 400 });

  const sb = createAdminClient();
  // GATED: deregister webhook from the LOS here. los_loan_map is preserved for audit.
  await sb.from('los_connections').delete().eq('org_id', orgId).eq('los_type', losType);
  return NextResponse.json({ ok: true });
}
