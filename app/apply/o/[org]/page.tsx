/**
 * Phase 137 — brokerage-level apply landing ({brokerage}.ashleyiq.com root, or
 * /apply/o/{brokerage}). Same flow as the per-LO link but unassigned to a specific
 * MLO until the brokerage routes the lead.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicApplyStart } from './[mlo]/PublicApplyStart';

export const dynamic = 'force-dynamic';

async function resolveOrg(slug: string) {
  const sb = createAdminClient();
  const { data } = await sb.from('organizations').select('id, name, brand_color').eq('slug', slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: { org: string } }): Promise<Metadata> {
  const org = await resolveOrg(params.org);
  return { title: org?.name ? `Apply with ${org.name}` : 'Start your application', robots: 'noindex' };
}

export default async function BrokerageApplyPage({ params }: { params: { org: string } }) {
  const org = await resolveOrg(params.org);
  if (!org) notFound();

  return (
    <PublicApplyStart
      orgSlug={params.org}
      mloSlug=""
      loName={org.name ?? 'Start your application'}
      orgName={org.name ?? ''}
      nmls={null}
      brandColor={org.brand_color ?? '#C9A95C'}
    />
  );
}
