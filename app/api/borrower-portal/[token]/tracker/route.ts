// Phase 123 — Uber-style loan tracker for the borrower portal (token-gated).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken, trackerOrderForStage, eligibleCelebrations } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const { data: lead } = await sb
    .from('leads')
    .select('id, stage, property_address, closing_date')
    .eq('id', id.leadId)
    .eq('org_id', id.orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const [{ data: stages }, { data: progress }, { data: celebrations }] = await Promise.all([
    sb.from('loan_tracker_stages').select('stage_order, stage_key, stage_label, stage_description').order('stage_order'),
    sb.from('loan_stage_progress').select('current_stage_order, current_stage_pct, stage_reached_at').eq('lead_id', id.leadId).maybeSingle(),
    sb.from('loan_celebration_states').select('celebration_type, shown_at').eq('lead_id', id.leadId),
  ]);

  // leads.stage is the source of truth for the stage; the progress row (if an LO set
  // it) provides the intra-stage percentage.
  const currentStageOrder = progress?.current_stage_order ?? trackerOrderForStage(lead.stage as string);
  const currentStagePct = progress?.current_stage_pct ?? (lead.stage === 'closed' ? 100 : 50);

  const daysToClosing = lead.closing_date
    ? Math.ceil((new Date(lead.closing_date as string).getTime() - Date.now()) / 86_400_000)
    : null;

  // Pending = eligible for this stage but not yet shown.
  const shown = new Set((celebrations ?? []).filter((c) => c.shown_at).map((c) => c.celebration_type as string));
  const pendingCelebrations = eligibleCelebrations(lead.stage as string).filter((t) => !shown.has(t));

  return NextResponse.json({
    loan: { id: lead.id, propertyAddress: lead.property_address, closingDate: lead.closing_date, daysToClosing },
    progress: { current_stage_order: currentStageOrder, current_stage_pct: currentStagePct },
    stages: stages ?? [],
    pendingCelebrations,
  });
}
