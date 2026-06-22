/**
 * Phase 41.7 — LOS connection management (admin only).
 *   GET    → connection status for each LOS (never returns decrypted creds)
 *   POST   → connect: encrypt + store credentials, generate webhook secret
 *   DELETE → disconnect: remove credentials (los_loan_map preserved for audit)
 *
 * Arive auto-registers its hook subscriptions on connect (real REST API +
 * X-API-KEY). LendingPad webhook registration / initial sync remain gated on a
 * reachable API; credentials are stored encrypted regardless.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto/encrypt';
import { randomBytes } from 'crypto';
import { ariveBase, ariveToken, subscribeAriveHooks } from '@/lib/los/arive';
import { pullAriveToInbound } from '@/lib/los/arivePull';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

  const b = (await req.json().catch(() => ({}))) as { los_type?: string; api_key?: string; api_secret?: string; base_url?: string; client_id?: string; client_secret?: string };
  if (!LOS_TYPES.includes(b.los_type ?? '')) return NextResponse.json({ error: 'Invalid los_type' }, { status: 400 });
  if (!b.api_key) return NextResponse.json({ error: 'API key is required' }, { status: 400 });

  const isArive = b.los_type === 'arive';
  // Arive's API lives on the broker's own *.myarive.com subdomain and is OAuth-gated.
  if (isArive && !ariveBase(b.base_url)) return NextResponse.json({ error: 'Your Arive Base URL (e.g. https://yourname.myarive.com) is required.' }, { status: 400 });
  if (isArive && (!b.client_id || !b.client_secret)) return NextResponse.json({ error: 'Arive needs the Client ID and Secret Key (from Arive → Settings → API Integrations) for OAuth.' }, { status: 400 });

  // Arive packs Client ID + Secret Key into api_secret_enc (OAuth creds) — no schema
  // change. Other LOS use api_secret_enc for their single API secret.
  const secretToStore = isArive ? JSON.stringify({ clientId: b.client_id, secret: b.client_secret }) : b.api_secret;

  const webhookSecret = randomBytes(24).toString('hex');
  const sb = createAdminClient();
  const { error } = await sb.from('los_connections').upsert({
    org_id: orgId,
    los_type: b.los_type,
    api_key_enc: encrypt(b.api_key),
    api_secret_enc: secretToStore ? encrypt(secretToStore) : null,
    webhook_secret: webhookSecret,
    base_url: b.base_url ?? null,
    is_active: true,
    sync_error: 'Credentials saved. Live sync activates once the LOS API is reachable.',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,los_type' });
  if (error) {
    console.error('[los] connect failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  // Arive: OAuth-gated REST API. Backfill into /inbound now (the pull does its own
  // login) so the pipeline shows up immediately, and try the live subscribe
  // best-effort (non-fatal).
  if (isArive) {
    const base = ariveBase(b.base_url)!;
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
    const webhookUrl = `${origin}/api/webhooks/arive?tenant_id=${orgId}&secret=${webhookSecret}`;

    const pull = await pullAriveToInbound(orgId, { maxPages: 3 });
    if (pull.gated) {
      // OAuth login / key / base URL didn't work — surface it as a hard connect error.
      await sb.from('los_connections').update({ sync_error: pull.reason }).eq('org_id', orgId).eq('los_type', 'arive');
      return NextResponse.json({ connected: true, los_type: 'arive', warning: pull.reason });
    }

    const auth = await ariveToken(base, b.api_key, JSON.stringify({ clientId: b.client_id, secret: b.client_secret }));
    const token = 'token' in auth ? auth.token : undefined;
    const { subscribed, failures } = await subscribeAriveHooks(base, b.api_key, webhookUrl, token);
    const live = failures.length === 0 ? `Live updates on (${subscribed} events).` : 'Live webhooks unavailable (subscribe blocked) — syncing on a schedule.';
    const imported = pull.seen === 0
      ? 'Connected, but Arive returned 0 records — the API key may not have loan/lead list access.'
      : `Connected — imported ${pull.staged} of ${pull.seen} record${pull.seen === 1 ? '' : 's'} to Inbound.`;
    const note = `${imported} ${live}`.slice(0, 480);
    await sb.from('los_connections').update({ sync_error: note }).eq('org_id', orgId).eq('los_type', 'arive');
    return NextResponse.json({ connected: true, los_type: 'arive', staged: pull.staged, seen: pull.seen, subscribed, failures, note });
  }

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
