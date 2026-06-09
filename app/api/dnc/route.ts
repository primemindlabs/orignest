/**
 * Phase 58.1 — DNC management.
 *   GET ?phone= → check-a-number (internal + registry status)
 *   GET         → internal suppression list
 *   POST        → add a number to the internal DNC (INSERT-only suppression)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { scrubPhone, normalizePhone } from '@/lib/compliance/dncScrub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const phone = new URL(req.url).searchParams.get('phone');
  if (phone) return NextResponse.json({ result: await scrubPhone(orgId, phone) });

  const sb = createAdminClient();
  const { data } = await sb.from('dnc_entries').select('id, phone_number, channel, source, notes, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(500);
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { phone?: string; channel?: string; source?: string; lead_id?: string; notes?: string };
  const phone = normalizePhone(b.phone ?? '');
  if (!phone) return NextResponse.json({ error: 'valid phone required' }, { status: 400 });
  const channel = ['call', 'sms', 'all'].includes(b.channel ?? '') ? b.channel : 'all';
  const source = ['consumer_request', 'stop_reply', 'national_registry', 'litigator_scrub', 'lo_manual', 'admin'].includes(b.source ?? '') ? b.source : 'lo_manual';

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { error } = await sb.from('dnc_entries').insert({ org_id: orgId, phone_number: phone, channel, source, lead_id: b.lead_id ?? null, added_by: profile?.id ?? null, notes: b.notes ?? null });
  if (error && !String(error.message).includes('duplicate')) { console.error('[dnc]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true, phone });
}
