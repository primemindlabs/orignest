/**
 * AI-assisted campaign drafting: turn a plain-language goal into a reviewable
 * multi-step plan. Does NOT write to the DB — the client reviews, then POSTs to
 * /api/campaign-manager/create.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { generateCampaignPlan } from '@/lib/ai/campaignBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { goal, audience } = (await req.json().catch(() => ({}))) as { goal?: string; audience?: string };
  if (!goal || !goal.trim()) return NextResponse.json({ error: 'goal required' }, { status: 400 });

  const { plan, aiUsed } = await generateCampaignPlan(goal.trim(), audience?.trim());
  return NextResponse.json({ plan, aiUsed });
}
