/**
 * Phase 146 — manage this LO's website chat widget.
 *   GET  → the widget (provisions one with a fresh public_key on first call) + embed snippet
 *   POST → update enabled / headline / greeting
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLS = 'id, public_key, enabled, headline, greeting';

async function profileId(sb: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

function embedFor(key: string): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.ashleyiq.com').replace(/\/$/, '');
  return `<script src="${appUrl}/api/chat/${key}/loader" async></script>`;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const loId = await profileId(sb, userId);

  let { data: w } = await sb.from('ai_web_widgets').select(COLS).eq('org_id', orgId).eq('lo_id', loId).maybeSingle();
  if (!w) {
    const key = randomBytes(16).toString('hex');
    const ins = await sb.from('ai_web_widgets').insert({ org_id: orgId, lo_id: loId, public_key: key }).select(COLS).single();
    w = ins.data;
  }
  if (!w) return NextResponse.json({ error: 'Could not provision widget' }, { status: 500 });
  return NextResponse.json({ widget: w, embed: embedFor(w.public_key) });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const loId = await profileId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
  if (typeof b.headline === 'string') patch.headline = b.headline.slice(0, 120);
  if (typeof b.greeting === 'string') patch.greeting = b.greeting.slice(0, 600);

  // Ensure a row exists (mirrors GET's provisioning), then update.
  const { data: existing } = await sb.from('ai_web_widgets').select('id').eq('org_id', orgId).eq('lo_id', loId).maybeSingle();
  if (!existing) {
    await sb.from('ai_web_widgets').insert({ org_id: orgId, lo_id: loId, public_key: randomBytes(16).toString('hex'), ...patch });
  } else {
    await sb.from('ai_web_widgets').update(patch).eq('id', (existing as { id: string }).id);
  }
  return NextResponse.json({ ok: true });
}
