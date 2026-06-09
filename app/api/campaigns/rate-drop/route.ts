/**
 * Phase 30.7 — Rate Drop campaign queue (LO-only).
 *   GET  → pending rate_drop drafts for the org (+ borrower name/savings)
 *   POST → run the scan now for this org
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { runRateDropScan } from '@/lib/ai/runRateDropScan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('campaign_drafts')
    .select('*, borrower_relationships(full_name, email)')
    .eq('org_id', orgId)
    .eq('campaign_type', 'rate_drop')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });
  return NextResponse.json({ drafts: data ?? [] });
}

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const result = await runRateDropScan(sb, orgId);
  return NextResponse.json({ ok: true, ...result });
}
