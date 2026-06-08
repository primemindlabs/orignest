import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Child tables re-parented from the secondary lead onto the primary.
// (condition_events is append-only audit and intentionally NOT re-parented.)
const REPARENT_TABLES = [
  'lead_notes',
  'lead_activities',
  'documents',
  'document_requests',
  'loan_conditions',
] as const;

/**
 * POST /api/leads/merge
 * Body: { primary_id, secondary_id }
 * Phase 1.3 — copies the secondary lead's notes/documents/activities/conditions
 * onto the primary, then archives the secondary (merged_into_id + archived_at).
 * Nothing is deleted — all history is preserved.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { primary_id?: string; secondary_id?: string }
    | null;
  const primaryId = body?.primary_id;
  const secondaryId = body?.secondary_id;
  if (!primaryId || !secondaryId || primaryId === secondaryId) {
    return NextResponse.json(
      { error: 'Distinct primary_id and secondary_id are required' },
      { status: 400 },
    );
  }

  const sb = createAdminClient();

  // Both leads must belong to this org and the secondary must not already be merged.
  const { data: leads } = await sb
    .from('leads')
    .select('id, archived_at, merged_into_id')
    .eq('org_id', orgId)
    .in('id', [primaryId, secondaryId]);

  const primary = leads?.find((l: { id: string }) => l.id === primaryId);
  const secondary = leads?.find((l: { id: string }) => l.id === secondaryId);
  if (!primary || !secondary) {
    return NextResponse.json({ error: 'Both leads must exist in this org' }, { status: 404 });
  }
  if (secondary.archived_at) {
    return NextResponse.json({ error: 'Secondary lead is already archived/merged' }, { status: 409 });
  }

  // Re-parent child records.
  const reparented: Record<string, number> = {};
  for (const table of REPARENT_TABLES) {
    const { data } = await sb
      .from(table)
      .update({ lead_id: primaryId })
      .eq('lead_id', secondaryId)
      .eq('org_id', orgId)
      .select('id');
    reparented[table] = data?.length ?? 0;
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const actorId = (profile?.id as string | undefined) ?? null;

  // Archive the secondary (soft — never deleted).
  await sb
    .from('leads')
    .update({ merged_into_id: primaryId, archived_at: new Date().toISOString() })
    .eq('id', secondaryId)
    .eq('org_id', orgId);

  // Append-only audit entry on the surviving lead.
  await sb.from('lead_activities').insert({
    lead_id: primaryId,
    org_id: orgId,
    actor_id: actorId,
    action: 'lead_merged',
    description: `Merged duplicate lead ${secondaryId} into this record`,
    metadata: { secondary_id: secondaryId, reparented },
  });

  return NextResponse.json({ ok: true, primaryId, secondaryId, reparented });
}
