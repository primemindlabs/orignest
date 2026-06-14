// Phase 130 — GET today's Business Pulse score (computes + caches once per day).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPulseContext } from '@/lib/businessPulse/access';
import { ensureTodaysPulse } from '@/lib/businessPulse/computePulseScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const sb = createAdminClient();
  const ctx = await getPulseContext(sb);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.locked) return NextResponse.json({ locked: true, tier: ctx.tier, score: null });
  if (!ctx.profileId) return NextResponse.json({ locked: false, score: null });

  const score = await ensureTodaysPulse(sb, ctx.orgId, ctx.profileId);
  return NextResponse.json({ locked: false, tier: ctx.tier, score });
}
