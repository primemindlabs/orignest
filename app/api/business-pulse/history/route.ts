// Phase 130 — GET 30-day Business Pulse trend.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPulseContext } from '@/lib/businessPulse/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = createAdminClient();
  const ctx = await getPulseContext(sb);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.locked) return NextResponse.json({ locked: true, history: [] });

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await sb
    .from('business_pulse_scores')
    .select('score_date, pulse_score, score_band, pipeline_velocity_score, relationship_health_score, revenue_trajectory_score, compliance_posture_score, growth_signals_score')
    .eq('org_id', ctx.orgId)
    .gte('score_date', since)
    .order('score_date', { ascending: true });

  return NextResponse.json({ locked: false, history: data ?? [] });
}
