/**
 * Phase 30.6 — daily velocity batch (cron-callable).
 *
 * Auth: Bearer CRON_SECRET (set in env + passed by the pg_cron net.http_post
 * Authorization header). No Clerk session — this path is allowlisted in
 * middleware and self-authorizes with the shared secret.
 *
 * Regenerates velocity predictions for active loans whose latest prediction is
 * missing or older than ~20h. Capped per run to bound cost/runtime.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runVelocityPrediction } from '@/lib/ai/runVelocityPrediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTIVE_STAGES = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
const BATCH_CAP = 75;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();

  // Active loans that don't have a fresh (<20h) prediction yet.
  const { data: loans } = await sb
    .from('leads')
    .select('id, org_id')
    .in('stage', ACTIVE_STAGES)
    .is('archived_at', null)
    .limit(500);

  const cutoff = Date.now() - 20 * 3_600_000;
  const candidates: Array<{ id: string; org_id: string }> = [];
  for (const lead of loans ?? []) {
    const { data: last } = await sb
      .from('velocity_predictions')
      .select('generated_at')
      .eq('lead_id', lead.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last || new Date(last.generated_at).getTime() < cutoff) candidates.push(lead);
    if (candidates.length >= BATCH_CAP) break;
  }

  let ok = 0;
  let failed = 0;
  for (const c of candidates) {
    const r = await runVelocityPrediction(sb, c.org_id, c.id);
    if (r.ok) ok += 1;
    else failed += 1;
  }

  return NextResponse.json({ processed: candidates.length, ok, failed, capped: candidates.length >= BATCH_CAP });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
