// Phase 132 — POST: generate a weekly content package (7 posts) for the LO.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature } from '@/lib/billing/features';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { getCurrentMarketRate } from '@/lib/goldmine/marketRates';
import { generateWeeklyPackage, rateContextFromRate } from '@/lib/contentStudio/generateWeeklyPackage';
import { buildNMLSFooter } from '@/lib/contentStudio/buildNMLSFooter';
import type { LOProfile } from '@/lib/contentStudio/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff)).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const tier = await resolveOrgTier(orgId);
  if (!hasFeature(tier, 'content_studio')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { focusTopic?: string; marketArea?: string; recentCloseType?: string };

  // LO + company identity for the NMLS footer.
  const [{ data: org }, { data: licenses }] = await Promise.all([
    sb.from('organizations').select('name, nmls_company_id, licensed_states').eq('id', orgId).maybeSingle(),
    sb.from('lo_licenses').select('state').eq('org_id', orgId).eq('user_id', profile.id),
  ]);
  const orgRow = (org ?? {}) as { name: string | null; nmls_company_id: string | null; licensed_states: string[] | null };
  const licStates = [...new Set(((licenses ?? []) as { state: string }[]).map((l) => l.state))];
  const states = licStates.length ? licStates : orgRow.licensed_states ?? [];

  const lo: LOProfile = {
    id: profile.id,
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    nmls_id: profile.nmls_id,
    licensed_states: states,
    company_name: orgRow.name ?? '',
    company_nmls: orgRow.nmls_company_id,
  };
  const nmlsFooter = buildNMLSFooter(lo);

  const rate30 = await getCurrentMarketRate(sb, '30yr_fixed');
  const rateContext = rateContextFromRate(rate30);
  const weekOf = mondayOf(new Date());

  // Create the package shell.
  const { data: pkg, error: pkgErr } = await sb
    .from('content_packages')
    .insert({ org_id: orgId, lo_id: profile.id, week_of: weekOf, generation_topic: body.focusTopic ?? null, market_area: body.marketArea ?? null, status: 'generating' })
    .select()
    .single();
  if (pkgErr || !pkg) return NextResponse.json({ error: pkgErr?.message ?? 'Could not create package' }, { status: 500 });

  try {
    const generated = await generateWeeklyPackage(lo, nmlsFooter, rateContext, body);
    const { data: posts } = await sb
      .from('content_posts')
      .insert(generated.map((g) => ({ ...g, package_id: pkg.id, org_id: orgId, lo_id: profile.id })))
      .select();

    await sb.from('content_packages').update({ status: 'ready', posts_generated: generated.length, updated_at: new Date().toISOString() }).eq('id', pkg.id);
    return NextResponse.json({ package: { ...pkg, status: 'ready', posts_generated: generated.length }, posts: posts ?? [] });
  } catch (e) {
    console.error('[content-studio/generate]', e);
    await sb.from('content_packages').update({ status: 'partial' }).eq('id', pkg.id);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
