/**
 * Phase 137 — branded full Smart-1003 landing for a specific LO.
 * Reached at {brokerage}.ashleyiq.com/{mlo} (rewritten here by middleware) or
 * directly at /apply/o/{brokerage}/{mlo}. Collects contact basics, then starts
 * the adaptive 1003 at /apply/smart/[token].
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicApplyStart } from './PublicApplyStart';

export const dynamic = 'force-dynamic';

async function resolve(orgSlug: string, mloSlug: string) {
  const sb = createAdminClient();
  const { data: org } = await sb
    .from('organizations')
    .select('id, name, brand_color')
    .eq('slug', orgSlug)
    .maybeSingle();
  if (!org) return null;
  const { data: lo } = await sb
    .from('profiles')
    .select('first_name, last_name, nmls_id, avatar_url')
    .eq('org_id', org.id)
    .eq('application_slug', mloSlug)
    .maybeSingle();
  if (!lo) return null;
  return { org, lo };
}

export async function generateMetadata({ params }: { params: { org: string; mlo: string } }): Promise<Metadata> {
  const r = await resolve(params.org, params.mlo);
  const name = r ? `${r.lo.first_name ?? ''} ${r.lo.last_name ?? ''}`.trim() : null;
  return { title: name ? `Apply with ${name}` : 'Start your application', robots: 'noindex' };
}

export default async function BrandedApplyPage({ params }: { params: { org: string; mlo: string } }) {
  const r = await resolve(params.org, params.mlo);
  if (!r) notFound();

  const loName = `${r.lo.first_name ?? ''} ${r.lo.last_name ?? ''}`.trim() || 'your loan officer';

  return (
    <PublicApplyStart
      orgSlug={params.org}
      mloSlug={params.mlo}
      loName={loName}
      orgName={r.org.name ?? ''}
      nmls={r.lo.nmls_id ?? null}
      brandColor={r.org.brand_color ?? '#C9A95C'}
    />
  );
}
