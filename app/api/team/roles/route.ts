/**
 * Phase 133 — team role management (admin / branch manager only).
 *   GET → active user_roles for the org (member -> role + assigned LO).
 *   PUT → assign a role to an existing member { user_id, role, assigned_lo_id? }.
 *         Deactivates the member's prior roles, upserts the new one, and syncs
 *         profiles.role so the existing role-aware nav reflects it immediately.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES = ['lo', 'loa', 'processor', 'branch_manager', 'admin'];
const ADMIN_ROLES = ['admin', 'branch_manager'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('user_roles')
    .select('user_id, role, assigned_lo_id, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true);
  return NextResponse.json({ roles: data ?? [] });
}

export async function PUT(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: 'Only admins can manage roles.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { user_id?: string; role?: string; assigned_lo_id?: string | null };
  if (!b.user_id || !ROLES.includes(b.role ?? '')) {
    return NextResponse.json({ error: 'user_id and a valid role are required' }, { status: 400 });
  }
  const assignedLo = b.role === 'loa' ? (b.assigned_lo_id ?? null) : null;
  if (b.role === 'loa' && !assignedLo) {
    return NextResponse.json({ error: 'An LOA must be assigned to a loan officer.' }, { status: 400 });
  }

  const sb = createAdminClient();
  // Member must belong to this org.
  const { data: member } = await sb.from('profiles').select('id').eq('id', b.user_id).eq('org_id', orgId).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const now = new Date().toISOString();
  await sb.from('user_roles').update({ is_active: false, updated_at: now }).eq('org_id', orgId).eq('user_id', b.user_id);
  const { error } = await sb.from('user_roles').upsert(
    { org_id: orgId, user_id: b.user_id, role: b.role, assigned_lo_id: assignedLo, is_active: true, updated_at: now },
    { onConflict: 'org_id,user_id,role' },
  );
  if (error) {
    console.error('[team/roles] upsert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  // Sync the legacy single-column role so the existing nav/layout reflect it.
  await sb.from('profiles').update({ role: b.role }).eq('id', b.user_id);

  return NextResponse.json({ ok: true, role: b.role, assigned_lo_id: assignedLo });
}
