// Phase 85 — GET ghost assessment for a loan; POST creates an AI-drafted intervention.
// POST returns the draft + score breakdown so the UI can open the TCPA review modal.

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { assessGhost } from '@/lib/ghost/gatherSignals';
import { draftGhostIntervention } from '@/lib/ghost/draftIntervention';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sb = createAdminClient();
    const assessment = await assessGhost(sb, orgId, params.loanId);
    if (!assessment) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    return NextResponse.json({ assessment });
  } catch (err) {
    console.error('[ghost-intervention GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: { params: { loanId: string } }) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = createAdminClient();
    const { data: lead } = await sb
      .from('leads')
      .select('id, first_name, stage, assigned_to')
      .eq('id', params.loanId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const assessment = await assessGhost(sb, orgId, params.loanId);
    if (!assessment) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const [{ data: caller }, { data: lo }] = await Promise.all([
      sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle(),
      lead.assigned_to
        ? sb.from('profiles').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const loName = lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() : 'your loan officer';

    const draft = await draftGhostIntervention({
      borrowerFirstName: lead.first_name ?? 'there',
      loName,
      daysSinceContact: assessment.days_since_contact,
      stage: lead.stage ?? null,
    });

    const { data: intervention } = await sb
      .from('ghost_interventions')
      .insert({
        org_id: orgId,
        lead_id: params.loanId,
        user_id: (caller?.id as string | undefined) ?? null,
        intervention_type: 'sms',
        ghost_score: assessment.score,
        band: assessment.band,
        suggested_message: draft.message,
        tcpa_acknowledged: false,
      })
      .select('id, suggested_message, ghost_score, band')
      .single();

    return NextResponse.json({ intervention, assessment, ai: draft.ai });
  } catch (err) {
    console.error('[ghost-intervention POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
