/**
 * Phase 36.4 — revoke a pending invitation (admin/manager only).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!['admin', 'branch_manager'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = createAdminClient();
  await sb.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', params.id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
