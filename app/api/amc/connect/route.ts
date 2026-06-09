/**
 * Phase 49.2 — AMC connection management (admin only). Credentials are AES-256-GCM
 * encrypted at rest (same lib as the LOS integration). Live order/status calls
 * activate once a real AMC account is connected.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto/encrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VENDORS = ['mercury_network', 'solidifi', 'servicelink', 'clear_capital', 'appraisal_nation', 'first_american', 'voxtur', 'other'];
const ADMIN = ['admin', 'branch_manager'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('amc_connections').select('vendor, display_name, is_active, last_verified_at, sync_error').eq('org_id', orgId);
  return NextResponse.json({ connections: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Only admins can connect an AMC.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { vendor?: string; display_name?: string; credentials?: Record<string, unknown> };
  if (!VENDORS.includes(b.vendor ?? '')) return NextResponse.json({ error: 'Invalid vendor' }, { status: 400 });
  if (!b.credentials || typeof b.credentials !== 'object') return NextResponse.json({ error: 'Credentials required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { error } = await sb.from('amc_connections').upsert({
    org_id: orgId, vendor: b.vendor, display_name: b.display_name || (b.vendor as string),
    credentials: encrypt(JSON.stringify(b.credentials)), is_active: true,
    sync_error: 'Credentials saved. Live ordering activates once the AMC API is reachable.',
    created_by: profile?.id ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,vendor' });
  if (error) { console.error('[amc] connect', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ connected: true, vendor: b.vendor });
}

export async function DELETE(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const vendor = new URL(req.url).searchParams.get('vendor') ?? '';
  if (!VENDORS.includes(vendor)) return NextResponse.json({ error: 'Invalid vendor' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('amc_connections').delete().eq('org_id', orgId).eq('vendor', vendor);
  return NextResponse.json({ ok: true });
}
