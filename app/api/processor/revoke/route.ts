import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface RevokePayload {
  assignmentId: string;
}

/**
 * POST /api/processor/revoke
 * Suspends a processor's access to the calling user's org.
 * Only admin/branch_manager can revoke.
 */
export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as RevokePayload | null;
  if (!body?.assignmentId) {
    return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
  }

  const sb = createAdminClient();

  // ── Validate caller is admin/branch_manager ────────────────────────────────
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (profile?.role !== 'admin' && profile?.role !== 'branch_manager') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // ── Validate assignment belongs to caller's org ────────────────────────────
  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const { data: assignment } = await sb
    .from('processor_assignments')
    .select('id')
    .eq('id', body.assignmentId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  // ── Suspend the assignment ─────────────────────────────────────────────────
  await sb
    .from('processor_assignments')
    .update({ status: 'suspended' })
    .eq('id', body.assignmentId);

  // ── Deactivate all file assignments for this processor in this org ─────────
  await sb
    .from('processor_file_assignments')
    .update({ active: false })
    .eq('org_id', org.id)
    .eq('processor_clerk_id', (
      await sb
        .from('processor_assignments')
        .select('processor_clerk_id')
        .eq('id', body.assignmentId)
        .maybeSingle()
        .then(({ data }) => data?.processor_clerk_id ?? '')
    ));

  return NextResponse.json({ ok: true });
}
