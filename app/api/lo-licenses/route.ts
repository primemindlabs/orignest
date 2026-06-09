/**
 * Phase 50.3 — LO state-license registry. GET (mine or ?user_id=), POST (add/
 * upsert by user+state), DELETE (?id=).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function myId(sb: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const target = new URL(req.url).searchParams.get('user_id') ?? (await myId(sb, userId));
  const { data } = await sb.from('lo_licenses').select('*').eq('org_id', orgId).eq('user_id', target ?? '').order('expiry_date');
  return NextResponse.json({ licenses: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const state = String(b.state ?? '').toUpperCase().slice(0, 2);
  if (state.length !== 2 || !b.expiry_date) return NextResponse.json({ error: 'state (2-letter) and expiry_date are required' }, { status: 400 });
  const sb = createAdminClient();
  const target = b.user_id ? String(b.user_id) : await myId(sb, userId);
  const { data, error } = await sb.from('lo_licenses').upsert({
    org_id: orgId, user_id: target, state, nmls_id: b.nmls_id ? String(b.nmls_id) : null,
    license_number: b.license_number ? String(b.license_number) : null,
    status: ['active', 'inactive', 'suspended', 'pending_renewal', 'expired'].includes(String(b.status)) ? String(b.status) : 'active',
    expiry_date: String(b.expiry_date), issue_date: b.issue_date ? String(b.issue_date) : null,
    auto_renew: b.auto_renew === true, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,state' }).select('*').single();
  if (error) { console.error('[lo-licenses]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ license: data });
}

export async function DELETE(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('lo_licenses').delete().eq('id', id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
