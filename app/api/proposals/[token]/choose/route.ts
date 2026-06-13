// Phase 122 — PUBLIC: borrower selects their preferred scenario from a proposal.
// No auth: share_token is the credential. Allowlisted in middleware.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const b = await request.json().catch(() => ({}));
  const scenarioId = (b.scenarioId ?? '').toString();
  if (!scenarioId) return NextResponse.json({ error: 'scenarioId required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: proposal } = await sb
    .from('loan_proposals')
    .select('id, org_id, lo_id, lead_id, recommended_scenario_id, comparison_scenario_ids')
    .eq('share_token', params.token)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  // The chosen scenario must be one presented in this proposal.
  const allowed = [proposal.recommended_scenario_id as string, ...((proposal.comparison_scenario_ids as string[]) ?? [])];
  if (!allowed.includes(scenarioId)) return NextResponse.json({ error: 'That option is not part of this proposal.' }, { status: 400 });

  await sb
    .from('loan_proposals')
    .update({ borrower_choice_scenario_id: scenarioId, borrower_choice_at: new Date().toISOString() })
    .eq('id', proposal.id);

  // Notify the LO of the borrower's selection.
  const { data: scenario } = await sb.from('loan_scenarios').select('scenario_name').eq('id', scenarioId).maybeSingle();
  const { data: lead } = await sb.from('leads').select('first_name, last_name').eq('id', proposal.lead_id as string).maybeSingle();
  const who = lead ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Your borrower' : 'Your borrower';
  if (proposal.lo_id) {
    await notify(sb, {
      orgId: proposal.org_id as string,
      userId: proposal.lo_id as string,
      type: 'system',
      title: `${who} selected a loan product`,
      body: `They chose "${(scenario?.scenario_name as string) ?? 'a scenario'}" from your proposal.`,
      link: `/leads/${proposal.lead_id}`,
      urgency: 2,
    });
  }

  return NextResponse.json({ ok: true });
}
