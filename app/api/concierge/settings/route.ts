/**
 * Phase 144 — Ashley Concierge per-LO settings.
 *   GET  → this LO's persona/autonomy config (merged with defaults)
 *   POST → upsert it
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_SETTINGS } from '@/lib/concierge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLS = 'enabled, autonomy_default, allow_autonomous, speed_to_lead, persona_tone, persona_specialties, products, business_goal, booking_url, application_url, max_ai_replies, custom_instructions';

async function profileId(sb: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const loId = await profileId(sb, userId);
  const { data } = await sb.from('ai_concierge_settings').select(COLS).eq('org_id', orgId).eq('lo_id', loId).maybeSingle();
  return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(data ?? {}) } });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const loId = await profileId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const modes = ['off', 'suggest', 'autonomous'];
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const row: Record<string, any> = {
    org_id: orgId, lo_id: loId,
    enabled: b.enabled === true,
    autonomy_default: modes.includes(b.autonomy_default) ? b.autonomy_default : 'suggest',
    allow_autonomous: b.allow_autonomous === true,
    speed_to_lead: b.speed_to_lead === true,
    persona_tone: str(b.persona_tone) ?? DEFAULT_SETTINGS.persona_tone,
    persona_specialties: str(b.persona_specialties),
    products: str(b.products),
    business_goal: str(b.business_goal) ?? DEFAULT_SETTINGS.business_goal,
    booking_url: str(b.booking_url),
    application_url: str(b.application_url),
    max_ai_replies: Number.isFinite(Number(b.max_ai_replies)) ? Math.max(1, Math.min(20, Number(b.max_ai_replies))) : 6,
    custom_instructions: str(b.custom_instructions),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('ai_concierge_settings').upsert(row, { onConflict: 'org_id,lo_id' });
  if (error) {
    console.error('[concierge settings] save failed', error);
    return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
