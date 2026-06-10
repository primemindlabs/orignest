/**
 * Phase 69 (UI audit fix) — persist a pricing-engine scenario. The Save button
 * previously only flashed "Saved" without writing anything; this makes it real.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { params?: Record<string, unknown>; results?: unknown; label?: string; lead_id?: string };
  if (!b.params) return NextResponse.json({ error: 'params required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { error } = await sb.from('pricing_scenarios').insert({ org_id: orgId, user_id: profile?.id ?? null, lead_id: b.lead_id ?? null, label: b.label ?? null, params: b.params, results: b.results ?? null });
  if (error) { console.error('[pricing/save]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
