/**
 * Phase 100 — realtor weekly market update.
 *   POST → generate a draft (AI summary + talking points) from the LO's rates.
 *   GET  → the LO's update history (newest first).
 * Clerk-scoped to the LO's own updates.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateRealtorEmailUpdate } from '@/lib/ai/marketUpdate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const num = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

function mondayOfWeek(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ updates: [] });
  const { data } = await sb
    .from('realtor_market_updates')
    .select('*')
    .eq('org_id', orgId).eq('lo_id', profile.id)
    .order('week_of', { ascending: false })
    .limit(52);
  return NextResponse.json({ updates: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rates = {
    rate_30yr_conv: num(b.rate_30yr_conv),
    rate_15yr_conv: num(b.rate_15yr_conv),
    rate_30yr_fha: num(b.rate_30yr_fha),
    rate_30yr_va: num(b.rate_30yr_va),
  };

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, first_name, last_name, nmls_id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();

  const loName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Your Loan Officer';
  const company = org?.name ?? '';
  const weekOfLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const { market_summary, talking_points } = await generateRealtorEmailUpdate({
    ...rates,
    week_of: weekOfLabel,
    lo_name: loName,
    service_areas: 'your market',
  });

  const source_disclosure =
    `Rates as of ${weekOfLabel}. Subject to change without notice. Not a commitment to lend. ` +
    `Your rate will vary based on credit profile, loan-to-value, property type, and other factors. ` +
    `${loName} | NMLS# ${profile.nmls_id ?? ''} | ${company} | Equal Housing Lender`;

  const { data: update, error } = await sb
    .from('realtor_market_updates')
    .insert({
      org_id: orgId,
      lo_id: profile.id,
      week_of: mondayOfWeek().toISOString().split('T')[0],
      ...rates,
      market_summary,
      talking_points,
      source_disclosure,
      status: 'draft',
    })
    .select()
    .single();
  if (error) {
    console.error('[market-update] generate insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ update });
}
