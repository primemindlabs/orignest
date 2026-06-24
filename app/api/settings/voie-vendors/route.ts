/**
 * Phase 150 — VOI/VOE vendor connections (admin only). Mirrors /api/settings/credit-vendors.
 *   GET → connections (masked creds) · POST → connect/update · DELETE → disconnect
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, maskTail } from '@/lib/crypto/encrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VENDORS = ['generic', 'truework', 'the_work_number', 'plaid_income'];
const AUTH = ['basic', 'bearer', 'api_key', 'none'];
const ADMIN = ['admin', 'branch_manager'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('voie_vendor_connections').select('id, vendor, api_url, auth_type, account_id, api_key_enc, is_active, last_run_at, last_error, created_at').eq('org_id', orgId).order('vendor');
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
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can connect a verification vendor.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const vendor = String(b.vendor ?? 'generic');
  const authType = String(b.auth_type ?? 'bearer');
  if (!VENDORS.includes(vendor)) return NextResponse.json({ error: 'Invalid vendor.' }, { status: 400 });
  if (!AUTH.includes(authType)) return NextResponse.json({ error: 'Invalid auth type.' }, { status: 400 });

  const sb = createAdminClient();
  const { data: existing } = await sb.from('voie_vendor_connections').select('id, api_key_enc, api_secret_enc').eq('org_id', orgId).eq('vendor', vendor).maybeSingle();

  const row: Record<string, any> = {
    org_id: orgId, vendor, auth_type: authType,
    api_url: b.api_url ? String(b.api_url) : null,
    account_id: b.account_id ? String(b.account_id) : null,
    is_active: b.is_active === false ? false : true,
    api_key_enc: b.api_key ? encrypt(String(b.api_key)) : (existing?.api_key_enc ?? null),
    api_secret_enc: b.api_secret ? encrypt(String(b.api_secret)) : (existing?.api_secret_enc ?? null),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('voie_vendor_connections').upsert(row, { onConflict: 'org_id,vendor' });
  if (error) { console.error('[voie-vendors] save failed', error); return NextResponse.json({ error: 'Could not save the connection.' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can disconnect a vendor.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('voie_vendor_connections').delete().eq('id', id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
