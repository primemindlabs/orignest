/**
 * Phase 58.3 — Content 360 per-contact engagement.
 *   GET  ?contact_id=&contact_type= → timeline + engagement score + stat pills
 *   POST → AI next-best-content recommendations (Haiku), cached
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateEngagementScore, type EngagementEvent } from '@/lib/content360/score';
import { generateContentRecommendations } from '@/lib/ai/content360';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contact_id');
  const contactType = url.searchParams.get('contact_type') ?? 'lead';
  if (!contactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: events } = await sb.from('content_engagements').select('content_type, content_title, event_type, event_metadata, occurred_at').eq('org_id', orgId).eq('contact_id', contactId).eq('contact_type', contactType).order('occurred_at', { ascending: false }).limit(200);
  const ev = (events ?? []) as EngagementEvent[];
  const score = calculateEngagementScore(ev);

  const emailsSent = ev.filter((e) => e.content_type.startsWith('email') && e.event_type === 'sent').length;
  const emailOpens = ev.filter((e) => e.content_type.startsWith('email') && e.event_type === 'opened').length;
  const lastAt = ev[0]?.occurred_at ?? null;
  const stats = { emails_sent: emailsSent, open_rate: emailsSent ? Math.round((emailOpens / emailsSent) * 100) : 0, total_engagements: ev.length, last_contact_at: lastAt };
  const { data: recs } = await sb.from('content_360_recommendations').select('recommendations, generated_at').eq('org_id', orgId).eq('contact_id', contactId).eq('contact_type', contactType).maybeSingle();
  return NextResponse.json({ timeline: ev, score, stats, recommendations: recs?.recommendations ?? null });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 501 });
  const b = (await req.json().catch(() => ({}))) as { contact_id?: string; contact_type?: string; loan_stage?: string };
  if (!b.contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
  const contactType = b.contact_type ?? 'lead';

  const sb = createAdminClient();
  const { data: events } = await sb.from('content_engagements').select('content_type, content_title, event_type, occurred_at').eq('org_id', orgId).eq('contact_id', b.contact_id).eq('contact_type', contactType).order('occurred_at', { ascending: false }).limit(60);
  const ev = (events ?? []) as EngagementEvent[];
  const score = calculateEngagementScore(ev);
  const lastAt = ev[0]?.occurred_at;
  const days = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86_400_000) : null;
  const recent = ev.filter((e) => (Date.now() - new Date(e.occurred_at).getTime()) / 86_400_000 <= 30);

  const recs = await generateContentRecommendations({ contact_type: contactType, loan_stage: b.loan_stage, days_since_last_contact: days, tier: score.tier, recent_count: recent.length, recent_types: Array.from(new Set(recent.map((e) => e.content_type))), last_content_title: ev[0]?.content_type ?? undefined });
  await sb.from('content_360_recommendations').upsert({ org_id: orgId, contact_id: b.contact_id, contact_type: contactType, recommendations: recs, generated_at: new Date().toISOString() }, { onConflict: 'contact_id,contact_type' });
  return NextResponse.json({ recommendations: recs });
}
