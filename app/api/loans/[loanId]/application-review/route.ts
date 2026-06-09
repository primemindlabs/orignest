/**
 * Phase 59.6 — AI pre-submission review for a loan's application.
 * POST → runs the smart-conditions engine over the submitted summary + an AI
 * underwriter review (Haiku), persists completeness + blocking + result on the lead.
 * The summary is provided by the client (sanitized — no SSN/DOB).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateConditions, completenessFromConditions } from '@/lib/application/smartConditions';
import { reviewApplication } from '@/lib/ai/applicationReview';
import type { LoanApplication } from '@/types/application';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { application?: Partial<LoanApplication> };
  const app = b.application ?? {};

  const conditions = evaluateConditions(app);
  const { blocking, ready } = completenessFromConditions(conditions);

  let aiReview = null;
  if (process.env.ANTHROPIC_API_KEY) {
    aiReview = await reviewApplication(app as Record<string, unknown>);
  }

  const sb = createAdminClient();
  await sb.from('leads').update({
    application_blocking_conditions: conditions.filter((c) => c.severity === 'blocking').map((c) => c.trigger),
    application_last_ai_review_at: new Date().toISOString(),
    application_ai_review_result: aiReview,
  }).eq('id', params.loanId).eq('org_id', orgId);

  return NextResponse.json({ conditions, blocking, ready: ready && (aiReview?.ready_to_submit ?? true), ai_review: aiReview, ai_gated: !process.env.ANTHROPIC_API_KEY });
}
