// Phase 130 — GET branch-vs-industry benchmark comparison.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPulseContext } from '@/lib/businessPulse/access';
import { computeOrgBenchmarkMetrics, buildBenchmarkRows } from '@/lib/businessPulse/benchmarks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = createAdminClient();
  const ctx = await getPulseContext(sb);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.locked) return NextResponse.json({ locked: true, rows: [] });

  const metrics = await computeOrgBenchmarkMetrics(sb, ctx.orgId);
  return NextResponse.json({ locked: false, rows: buildBenchmarkRows(metrics) });
}
