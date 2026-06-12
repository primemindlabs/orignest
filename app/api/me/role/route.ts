/**
 * Phase 133 — GET /api/me/role
 * The reliable role source for client code (useUserRole). Reads via the Clerk
 * server context + admin client (the browser can't read user_roles directly,
 * since RLS keys off auth.uid() which this Clerk app never sets).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRoleForUser } from '@/lib/roles/getRoleForUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ role: 'lo', assigned_lo_id: null, profile_id: null });

  const sb = createAdminClient();
  const resolved = await getRoleForUser(sb, userId, orgId);
  return NextResponse.json({
    role: resolved.role,
    assigned_lo_id: resolved.assignedLoId,
    profile_id: resolved.profileId,
  });
}
