/**
 * Phase 146 — POST /api/widget/[key]/start : open an anonymous chat session.
 * Public (key-gated). Returns a session token + the widget greeting/headline.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { key: string } }) {
  const sb = createAdminClient();
  const { data: widget } = await sb.from('ai_web_widgets').select('id, org_id, enabled, greeting, headline').eq('public_key', params.key).maybeSingle();
  if (!widget || !widget.enabled) return NextResponse.json({ error: 'Widget unavailable' }, { status: 404 });

  const token = randomBytes(24).toString('hex');
  const { data: session, error } = await sb.from('ai_web_sessions').insert({
    org_id: widget.org_id, widget_id: widget.id, session_token: token, status: 'active',
  }).select('id').single();
  if (error || !session) return NextResponse.json({ error: 'Could not start chat' }, { status: 500 });

  return NextResponse.json({ session_token: token, greeting: widget.greeting, headline: widget.headline });
}
