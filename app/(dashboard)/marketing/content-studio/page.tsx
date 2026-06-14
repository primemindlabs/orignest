// Phase 132 — Ashley Content Studio™ (Pro/Growth tier).
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconSparkles } from '@tabler/icons-react';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature, FEATURE_COPY } from '@/lib/billing/features';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { ContentStudioPage } from '@/components/contentStudio/ContentStudioPage';
import type { ContentPackageRow, ContentPostRow } from '@/lib/contentStudio/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Content Studio' };

export default async function ContentStudioRoute() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const tier = await resolveOrgTier(orgId);

  if (!hasFeature(tier, 'content_studio')) {
    const copy = FEATURE_COPY.content_studio!;
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-gradient-to-r from-[#FEFDF9] to-[#FFF8ED] rounded-2xl border border-[#C9A95C]/20 px-6 py-6">
          <div className="flex items-center gap-2 mb-1">
            <IconSparkles size={18} className="text-[#C9A95C]" />
            <h1 className="font-semibold text-[#1A1A1A] text-lg" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>{copy.title}</h1>
            <span className="text-xs bg-[#C9A95C] text-white px-2 py-0.5 rounded-full">Pro</span>
          </div>
          <p className="text-sm text-[#6B7B8D] mb-4">{copy.benefit}</p>
          <Link href="/settings/billing" className="inline-block bg-[#C9A95C] text-white text-sm px-5 py-2.5 rounded-lg hover:brightness-95">Upgrade to Pro</Link>
        </div>
      </div>
    );
  }

  const profile = await resolveLoProfile(sb, userId);
  let pkg: ContentPackageRow | null = null;
  let posts: ContentPostRow[] = [];
  if (profile) {
    const { data: latest } = await sb
      .from('content_packages')
      .select('*')
      .eq('lo_id', profile.id)
      .order('week_of', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    pkg = (latest as ContentPackageRow | null) ?? null;
    if (pkg) {
      const { data: postRows } = await sb.from('content_posts').select('*').eq('package_id', pkg.id).order('created_at', { ascending: true });
      posts = (postRows ?? []) as ContentPostRow[];
    }
  }

  return (
    <div className="p-6">
      <ContentStudioPage initialPackage={pkg} initialPosts={posts} />
    </div>
  );
}
