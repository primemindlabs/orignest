// Phase 122 — generate (POST) + list (GET) AI loan proposals for a loan (lead).
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateProposalContent, termYears } from '@/lib/proposals/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ proposals: [] });

  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_proposals')
    .select('id, share_token, recommended_scenario_id, comparison_scenario_ids, sent_at, sent_channel, viewed_at, borrower_choice_scenario_id, created_at')
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .order('created_at', { ascending: false });
  return NextResponse.json({ proposals: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const recId = (b.recommendedScenarioId ?? '').toString();
  if (!recId) return NextResponse.json({ error: 'recommendedScenarioId required' }, { status: 400 });
  const compIds: string[] = Array.isArray(b.comparisonScenarioIds)
    ? b.comparisonScenarioIds.filter((x: unknown) => typeof x === 'string' && x !== recId).slice(0, 3)
    : [];

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, first_name, last_name').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, property_address, loan_type')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // All scenarios must belong to this org + loan.
  const wantIds = Array.from(new Set([recId, ...compIds]));
  const { data: scenarios } = await sb.from('loan_scenarios').select('*').eq('org_id', orgId).eq('lead_id', params.loanId).in('id', wantIds);
  const recommended = (scenarios ?? []).find((s) => s.id === recId);
  if (!recommended) return NextResponse.json({ error: 'Recommended scenario not found for this loan' }, { status: 404 });
  const comparisons = compIds.map((id) => (scenarios ?? []).find((s) => s.id === id)).filter(Boolean) as Record<string, unknown>[];

  const loName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your loan officer';
  const content = await generateProposalContent(
    loName,
    { firstName: (lead.first_name as string) ?? 'there', lastName: (lead.last_name as string) ?? '' },
    { propertyAddress: (lead.property_address as string) ?? null, purchasePrice: (recommended.purchase_price as number) ?? null, loanType: (recommended.loan_type as string) ?? (lead.loan_type as string) ?? 'conventional' },
    { loanType: (recommended.loan_type as string) ?? 'conventional', termYears: termYears(recommended.loan_term_months as number) },
    comparisons.map((c) => ({ loanType: (c.loan_type as string) ?? 'conventional', termYears: termYears(c.loan_term_months as number) })),
  );

  const { data: proposal, error } = await sb
    .from('loan_proposals')
    .insert({
      org_id: orgId,
      lo_id: profile.id,
      lead_id: params.loanId,
      recommended_scenario_id: recId,
      comparison_scenario_ids: compIds,
      ...content,
    })
    .select('id, share_token')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('host') ?? 'app.ashleyiq.com'}`;
  return NextResponse.json({ proposalId: proposal.id, shareToken: proposal.share_token, proposalUrl: `${origin}/proposal/${proposal.share_token}` }, { status: 201 });
}
