import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyLO } from '@/lib/credit-repair/notify';

export const dynamic = 'force-dynamic';

const MILESTONES = [580, 620, 640, 680, 720];

export async function POST(req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid' }, { status: 403 });

  const { enrollmentId, scoreExp, scoreEqx, scoreTu } = (await req.json()) as {
    enrollmentId: string; scoreExp: number; scoreEqx: number; scoreTu: number;
  };

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, target_score, current_score_exp, current_score_eqx, current_score_tu, score_history')
    .eq('id', enrollmentId)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const avgNew = Math.round((scoreExp + scoreEqx + scoreTu) / 3);
  const prevPresent = [enrollment.current_score_exp, enrollment.current_score_eqx, enrollment.current_score_tu].filter((s: number | null): s is number => typeof s === 'number');
  const prevAvg = prevPresent.length ? Math.round(prevPresent.reduce((a, b) => a + b, 0) / prevPresent.length) : 0;

  const history: unknown[] = Array.isArray(enrollment.score_history) ? (enrollment.score_history as unknown[]) : [];
  history.push({ date: new Date().toISOString().split('T')[0], exp: scoreExp, eqx: scoreEqx, tu: scoreTu, avg: avgNew, source: 'manual' });

  const target = (enrollment.target_score as number) ?? 640;
  const isMortgageReady = avgNew >= target;

  await sb.from('credit_repair_enrollments').update({
    current_score_exp: scoreExp,
    current_score_eqx: scoreEqx,
    current_score_tu: scoreTu,
    score_history: history,
    ...(isMortgageReady ? { status: 'mortgage_ready', mortgage_ready_at: new Date().toISOString() } : {}),
  }).eq('id', enrollmentId);

  const crossedMilestone = MILESTONES.find((m) => prevAvg < m && avgNew >= m);
  if (isMortgageReady) {
    await notifyLO(sb, { orgId: pt.org_id as string, enrollmentId, leadId: pt.lead_id as string, type: 'mortgage_ready', payload: { score: avgNew, target }, via: ['in_app', 'email'] });
  } else if (crossedMilestone) {
    await notifyLO(sb, { orgId: pt.org_id as string, enrollmentId, leadId: pt.lead_id as string, type: 'score_milestone', payload: { score: avgNew, milestone: crossedMilestone, target }, via: ['in_app', 'email'] });
  }

  return NextResponse.json({ avgScore: avgNew, isMortgageReady, crossedMilestone: crossedMilestone ?? null });
}
