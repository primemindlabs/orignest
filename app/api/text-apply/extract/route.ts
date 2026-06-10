/**
 * Phase 68 — parse free-text pre-qual replies into structured fields (Claude Haiku,
 * pure fallback) and mint a 72h apply-token for the pre-populated 1003 link.
 * The Twilio inbound webhook (gated) calls this same logic per conversation turn.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { extractPreQualData } from '@/lib/textApply/extraction';
import { generateApplyToken } from '@/lib/textApply/applyToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { address?: string; value?: string; credit?: string; lead_id?: string; keyword?: string };

  const extracted = await extractPreQualData({ address: b.address, value: b.value, credit: b.credit });
  const token = generateApplyToken({ lead_id: b.lead_id ?? 'preview', org_id: orgId, keyword: b.keyword, property_address: extracted.property_address, estimated_value: extracted.estimated_value, credit_range: extracted.credit_range });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({ extracted, apply_url: `${base}/apply-1003/${token}`, ai_gated: !process.env.ANTHROPIC_API_KEY });
}
