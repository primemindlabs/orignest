/**
 * Phase 68 — parse free-text pre-qual replies into structured fields (Claude Haiku,
 * pure fallback). Returns the LO's branded application link so the SMS auto-reply can
 * hand the borrower a working full-1003 (Phase 137 — previously pointed at a dead route).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractPreQualData } from '@/lib/textApply/extraction';
import { ensureApplicationSlug } from '@/lib/auth/slug';
import { ensureOrgSlug } from '@/lib/tenant/orgSlug';
import { buildApplyUrl } from '@/lib/tenant/applyLinks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { address?: string; value?: string; credit?: string; lead_id?: string; keyword?: string };

  const extracted = await extractPreQualData({ address: b.address, value: b.value, credit: b.credit });

  // Build the LO's branded application link (Phase 137), generating slugs on-demand.
  const sb = createAdminClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, nmls_id, application_slug').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('organizations').select('id, name, slug').eq('id', orgId).maybeSingle(),
  ]);

  let applyUrl: string | null = null;
  if (org) {
    const orgSlug = await ensureOrgSlug(sb, { id: org.id, name: org.name ?? null, slug: org.slug ?? null });
    const mloSlug = profile ? await ensureApplicationSlug(sb, { id: profile.id, first_name: profile.first_name, last_name: profile.last_name, nmls_id: profile.nmls_id, application_slug: profile.application_slug }) : null;
    if (orgSlug) applyUrl = buildApplyUrl(orgSlug, mloSlug);
  }

  return NextResponse.json({ extracted, apply_url: applyUrl, ai_gated: !process.env.ANTHROPIC_API_KEY });
}
