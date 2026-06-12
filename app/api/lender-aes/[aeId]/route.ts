import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwner } from '@/lib/lenderAe/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ aeId: string }> };

const EDITABLE = [
  'lender_name', 'lender_website', 'lender_type', 'ae_name', 'ae_email', 'ae_phone',
  'ae_cell', 'ae_linkedin', 'ae_title', 'loan_types', 'preferred', 'notes',
] as const;

async function loadOwned(sb: ReturnType<typeof createAdminClient>, aeId: string, orgId: string, me: string, seesAll: boolean) {
  let q = sb.from('lender_ae_connections').select('id, lo_id, org_id').eq('id', aeId).eq('org_id', orgId);
  if (!seesAll) q = q.eq('lo_id', me);
  const { data } = await q.maybeSingle();
  return data;
}

// PATCH — update AE fields (owner, or admin/BM within the org).
export async function PATCH(req: Request, { params }: Ctx) {
  const { aeId } = await params;
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { me, seesAll } = await resolveOwner(sb, userId, role);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (!(await loadOwned(sb, aeId, orgId, me, seesAll))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in b) patch[k] = b[k];

  const { data: ae, error } = await sb.from('lender_ae_connections').update(patch).eq('id', aeId).select('*').single();
  if (error) {
    console.error('[lender-aes PATCH]', error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  return NextResponse.json({ ae });
}

// DELETE — soft delete (is_active = false). Never hard-deletes the relationship record.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { aeId } = await params;
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { me, seesAll } = await resolveOwner(sb, userId, role);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (!(await loadOwned(sb, aeId, orgId, me, seesAll))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sb.from('lender_ae_connections').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', aeId);
  return NextResponse.json({ ok: true });
}
