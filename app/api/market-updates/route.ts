/**
 * Phase 30.8 — Market Update Generator (LO-only).
 *   GET  → latest market update for the org
 *   POST → generate 3-format content from the entered rates
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateMarketUpdate } from '@/lib/ai/marketUpdate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('market_updates').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ update: data ?? null });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { rate30yr?: number; rate15yr?: number; rateChangeBps?: number; marketContext?: string };
  const rate30yr = Number(body.rate30yr);
  const rate15yr = Number(body.rate15yr);
  if (!Number.isFinite(rate30yr) || !Number.isFinite(rate15yr)) {
    return NextResponse.json({ error: 'Enter the current 30yr and 15yr rates.' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, first_name, last_name').eq('clerk_user_id', userId).maybeSingle();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();
  const loName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || org?.name || 'your loan officer';

  let content;
  try {
    content = await generateMarketUpdate({ rate30yr, rate15yr, rateChangeBps: Number(body.rateChangeBps) || 0, loName, marketContext: body.marketContext ?? null });
  } catch (err) {
    console.error('[market-update] generation failed', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
  }

  const { data: inserted, error } = await sb
    .from('market_updates')
    .insert({
      org_id: orgId,
      generated_for: profile?.id ?? null,
      rate_30yr_fixed: rate30yr,
      rate_15yr_fixed: rate15yr,
      rate_change_bps: Number(body.rateChangeBps) || 0,
      market_context: body.marketContext ?? null,
      linkedin_post: content.linkedin_post,
      instagram_caption: content.instagram_caption,
      sms_blast: content.sms_blast,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ update: inserted });
}
