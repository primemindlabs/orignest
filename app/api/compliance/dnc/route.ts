/**
 * Phase 71 (A6) — internal DNC suppression list management. LIVE.
 *   GET  → list suppressed numbers for the org
 *   POST → manually add a number (INSERT-only ledger; removal is intentionally not
 *          supported — a number leaves suppression only via a new consent record).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/compliance/dncScrub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const q = normalizePhone(new URL(req.url).searchParams.get('q') ?? '');
  const sb = createAdminClient();
  let query = sb.from('dnc_entries').select('id, phone_number, channel, source, notes, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(500);
  if (q) query = query.ilike('phone_number', `%${q}%`);
  const { data } = await query;
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { phone?: string; channel?: string; notes?: string };
  const phone = normalizePhone(b.phone ?? '');
  if (phone.length < 10) return NextResponse.json({ error: 'Valid phone required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { error } = await sb.from('dnc_entries').insert({ org_id: orgId, phone_number: phone, channel: ['sms', 'voice', 'all'].includes(b.channel ?? '') ? b.channel : 'all', source: 'manual', added_by: profile?.id ?? null, notes: b.notes ?? null });
  if (error) { console.error('[dnc/add]', error); return NextResponse.json({ error: 'add_failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
