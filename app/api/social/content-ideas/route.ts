/**
 * Phase 56.4 — generate AI social content ideas + LinkedIn notes.
 *   GET                → seeded platform content-idea library
 *   POST {kind:'ideas'}→ AI-generated ideas (Haiku) for the LO's context
 *   POST {kind:'linkedin', ...} → a <300-char LinkedIn connection note
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateContentIdeas, composeLinkedInNote } from '@/lib/social/contentIdeas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('content_ideas').select('id, content_type, title, caption_template, suggested_hashtags').or(`org_id.is.null,org_id.eq.${orgId}`).eq('is_active', true);
  return NextResponse.json({ ideas: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 501 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('clerk_user_id', userId).maybeSingle();
  const loName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your Loan Officer';

  if (b.kind === 'linkedin') {
    const note = await composeLinkedInNote({ prospect_name: String(b.prospect_name ?? 'there'), prospect_title: b.prospect_title ? String(b.prospect_title) : undefined, prospect_company: b.prospect_company ? String(b.prospect_company) : undefined, connection_context: String(b.connection_context ?? 'realtor_in_target_market'), lo_name: loName });
    return NextResponse.json({ note, length: note.length });
  }

  const ideas = await generateContentIdeas({ lo_name: loName, nmls: profile?.nmls_id ?? undefined, market_conditions: String(b.market_conditions ?? 'stable'), recent_closings: Number(b.recent_closings ?? 0), target_audience: String(b.target_audience ?? 'first_time_buyers') });
  return NextResponse.json({ ideas });
}
