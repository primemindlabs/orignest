/**
 * Phase 61.2 — Text-to-Apply keyword setup. GET list (with lead counts), POST add
 * (UNIQUE number+keyword conflict surfaced), PATCH toggle active.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data: keywords } = await sb.from('text_to_apply_keywords').select('id, twilio_number, keyword, is_active, welcome_message, created_at').eq('org_id', orgId).order('created_at', { ascending: false });
  // Lead counts per keyword (completed TTA sessions → leads).
  const ids = (keywords ?? []).map((k) => k.id);
  const counts = new Map<string, number>();
  if (ids.length) { const { data: sess } = await sb.from('tta_sessions').select('keyword_id').eq('org_id', orgId).not('lead_id', 'is', null).in('keyword_id', ids); for (const s of sess ?? []) if (s.keyword_id) counts.set(s.keyword_id, (counts.get(s.keyword_id) ?? 0) + 1); }
  return NextResponse.json({ keywords: (keywords ?? []).map((k) => ({ ...k, leads: counts.get(k.id) ?? 0 })) });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { twilio_number?: string; keyword?: string; welcome_message?: string };
  if (!b.twilio_number || !b.keyword) return NextResponse.json({ error: 'twilio_number and keyword required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { error } = await sb.from('text_to_apply_keywords').insert({ org_id: orgId, lo_id: profile?.id ?? null, twilio_number: b.twilio_number.trim(), keyword: b.keyword.trim().toUpperCase(), welcome_message: b.welcome_message || undefined });
  if (error) return NextResponse.json({ error: String(error.message).includes('duplicate') ? 'That keyword is already claimed on this number.' : 'save_failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; is_active?: boolean };
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('text_to_apply_keywords').update({ is_active: b.is_active }).eq('id', b.id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
