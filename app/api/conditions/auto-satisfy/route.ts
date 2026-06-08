import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { autoSatisfyConditions, type AutoSatisfyResult } from '@/lib/conditions/autoSatisfy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Reading documents + a Sonnet call can take a while; allow headroom.
export const maxDuration = 120;

const MAX_DOCS_PER_RUN = 5;

/**
 * Phase 5.1 — POST /api/conditions/auto-satisfy
 * Body: { leadId, documentRequestId? }
 *  - documentRequestId given → review just that document
 *  - omitted → review up to 5 most-recent uploaded documents for the lead
 */
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { leadId?: string; documentRequestId?: string }
    | null;
  const leadId = body?.leadId;
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

  const sb = createAdminClient();

  // Confirm the lead belongs to this org before doing any work.
  const { data: lead } = await sb
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Resolve the triggering staff member's profile id for the audit trail.
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const actorId = (profile?.id as string | undefined) ?? null;

  // Determine which document(s) to review.
  let documentIds: string[];
  if (body?.documentRequestId) {
    documentIds = [body.documentRequestId];
  } else {
    const { data: docs } = await sb
      .from('document_requests')
      .select('id, uploaded_at')
      .eq('lead_id', leadId)
      .eq('org_id', orgId)
      .not('file_path', 'is', null)
      .order('uploaded_at', { ascending: false })
      .limit(MAX_DOCS_PER_RUN);
    documentIds = (docs ?? []).map((d: { id: string }) => d.id);
  }

  if (documentIds.length === 0) {
    return NextResponse.json(
      { error: 'No uploaded documents to review for this lead' },
      { status: 400 },
    );
  }

  const results: AutoSatisfyResult[] = [];
  const errors: { documentRequestId: string; error: string }[] = [];

  for (const documentRequestId of documentIds) {
    try {
      results.push(
        await autoSatisfyConditions({ orgId, leadId, documentRequestId, actorId }),
      );
    } catch (err) {
      errors.push({
        documentRequestId,
        error: err instanceof Error ? err.message : 'review failed',
      });
    }
  }

  const autoSatisfied = results.reduce((n, r) => n + r.autoSatisfied, 0);
  const flagged = results.reduce((n, r) => n + r.flagged, 0);
  const evaluated = results.reduce((n, r) => n + r.evaluated, 0);

  // Surface a lightweight run record on the lead timeline.
  if (autoSatisfied > 0 || flagged > 0) {
    await sb.from('lead_activities').insert({
      lead_id: leadId,
      org_id: orgId,
      actor_id: actorId,
      action: 'ai_conditions_reviewed',
      description: `AI reviewed ${results.length} document(s): ${autoSatisfied} auto-cleared, ${flagged} flagged for review`,
      metadata: { autoSatisfied, flagged, evaluated, agent: 'condition_auto_satisfy' },
    });
  }

  return NextResponse.json({
    documentsReviewed: results.length,
    evaluated,
    autoSatisfied,
    flagged,
    results,
    errors,
  });
}
