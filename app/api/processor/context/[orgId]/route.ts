import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * GET /api/processor/context/[orgId]
 *
 * Allows a processor to load context for a specific org they are assigned to.
 * Returns: org data + their active file assignments for that org.
 *
 * Security: validates the calling user has an active processor_assignment for orgId.
 */
export async function GET(
  _request: Request,
  { params }: { params: { orgId: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  // ── Validate processor has active assignment for this org ─────────────────
  const { data: assignment } = await sb
    .from('processor_assignments')
    .select('id, status, permissions')
    .eq('processor_clerk_id', userId)
    .eq('org_id', params.orgId)
    .maybeSingle();

  if (!assignment || assignment.status !== 'active') {
    return NextResponse.json(
      { error: 'Access denied. You do not have an active assignment for this organization.' },
      { status: 403 }
    );
  }

  // ── Fetch org data ────────────────────────────────────────────────────────
  const { data: org } = await sb
    .from('organizations')
    .select('id, name, nmls_company_id, licensed_states')
    .eq('id', params.orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // ── Fetch assigned leads for this processor in this org ───────────────────
  const { data: fileAssignments } = await sb
    .from('processor_file_assignments')
    .select('lead_id, assigned_at')
    .eq('processor_clerk_id', userId)
    .eq('org_id', params.orgId)
    .eq('active', true);

  const leadIds = (fileAssignments ?? []).map((fa) => fa.lead_id);

  let leads: unknown[] = [];
  if (leadIds.length > 0) {
    const { data } = await sb
      .from('leads')
      .select(
        'id, first_name, last_name, loan_type, loan_amount, stage, created_at, assigned_to, closing_date'
      )
      .in('id', leadIds)
      .in('stage', [
        'application',
        'processing',
        'underwriting',
        'conditional_approval',
        'clear_to_close',
      ]);
    leads = data ?? [];
  }

  return NextResponse.json({
    org,
    permissions: assignment.permissions,
    leads,
  });
}
