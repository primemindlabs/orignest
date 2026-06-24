/**
 * Phase 143 — wholesale lender submission connections (admin only).
 *   GET    → connections for the org (never returns decrypted creds; masks the key tail)
 *   POST   → connect/update: encrypt + store the API credential + endpoints
 *   DELETE → disconnect: remove the connection (submissions/locks preserved for audit)
 *
 * Distinct from /api/settings/los (the broker's OWN LOS) and /api/lender-aes (a per-LO
 * AE contact directory). These are the wholesale lenders we SUBMIT files to.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, maskTail } from '@/lib/crypto/encrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['generic_mismo', 'uwm', 'rocket_tpo', 'loanstream', 'custom'];
const AUTH_TYPES = ['bearer', 'api_key', 'basic', 'none'];
const ADMIN = ['admin', 'branch_manager'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('lender_submission_connections')
    .select('id, lender_name, platform, submit_url, lock_url, status_url, auth_type, base_url, api_key_enc, is_active, last_submission_at, last_error, created_at')
    .eq('org_id', orgId).order('lender_name');

  const connections = (data ?? []).map((c) => {
    const { api_key_enc, ...rest } = c as Record<string, any>;
    return { ...rest, has_credential: !!api_key_enc, credential_hint: api_key_enc ? maskTail(api_key_enc) : null };
  });
  return NextResponse.json({ connections });
}

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can connect a wholesale lender.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const lenderName = String(b.lender_name ?? '').trim();
  const platform = String(b.platform ?? 'generic_mismo');
  const authType = String(b.auth_type ?? 'bearer');
  if (!lenderName) return NextResponse.json({ error: 'Lender name is required.' }, { status: 400 });
  if (!PLATFORMS.includes(platform)) return NextResponse.json({ error: 'Invalid platform.' }, { status: 400 });
  if (!AUTH_TYPES.includes(authType)) return NextResponse.json({ error: 'Invalid auth type.' }, { status: 400 });

  const sb = createAdminClient();
  // Keep an existing credential when the form leaves the key blank on edit.
  const { data: existing } = await sb.from('lender_submission_connections').select('id, api_key_enc, api_secret_enc').eq('org_id', orgId).eq('lender_name', lenderName).maybeSingle();

  const row: Record<string, any> = {
    org_id: orgId, lender_name: lenderName, platform, auth_type: authType,
    submit_url: b.submit_url ? String(b.submit_url) : null,
    lock_url: b.lock_url ? String(b.lock_url) : null,
    status_url: b.status_url ? String(b.status_url) : null,
    base_url: b.base_url ? String(b.base_url) : null,
    is_active: b.is_active === false ? false : true,
    api_key_enc: b.api_key ? encrypt(String(b.api_key)) : (existing?.api_key_enc ?? null),
    api_secret_enc: b.api_secret ? encrypt(String(b.api_secret)) : (existing?.api_secret_enc ?? null),
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from('lender_submission_connections').upsert(row, { onConflict: 'org_id,lender_name' });
  if (error) {
    console.error('[lenders] connect failed', error);
    return NextResponse.json({ error: 'Could not save the lender connection.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can disconnect a lender.' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const sb = createAdminClient();
  await sb.from('lender_submission_connections').delete().eq('id', id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
