/**
 * Phase 100 — per-LO market update settings (auto-send schedule + subject prefix).
 *   GET → current settings (defaults if none). PUT → upsert.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

async function loId(sb: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const me = await loId(sb, userId);
  if (!me) return NextResponse.json({ settings: null });
  const { data } = await sb.from('realtor_market_update_settings').select('*').eq('lo_id', me).maybeSingle();
  return NextResponse.json({
    settings: data ?? {
      auto_send_enabled: false, send_day: 'monday', send_hour_utc: 13,
      rate_source_note: null, email_subject_prefix: 'This Week in Mortgage Rates',
    },
  });
}

export async function PUT(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = createAdminClient();
  const me = await loId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const patch: Record<string, unknown> = { org_id: orgId, lo_id: me };
  if (typeof b.auto_send_enabled === 'boolean') patch.auto_send_enabled = b.auto_send_enabled;
  if (DAYS.includes(String(b.send_day))) patch.send_day = b.send_day;
  if (typeof b.send_hour_utc === 'number' && b.send_hour_utc >= 0 && b.send_hour_utc <= 23) patch.send_hour_utc = b.send_hour_utc;
  if (b.rate_source_note !== undefined) patch.rate_source_note = (b.rate_source_note as string)?.slice(0, 200) ?? null;
  if (typeof b.email_subject_prefix === 'string') patch.email_subject_prefix = b.email_subject_prefix.slice(0, 120);

  const { data, error } = await sb.from('realtor_market_update_settings').upsert(patch, { onConflict: 'lo_id' }).select().single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ settings: data });
}
