// Phase 131 — Database Goldmine™ page (Pro/Growth tier).
import type { Metadata } from 'next';
import { BorrowerHubTabs } from '@/components/layout/HubTabs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconPick } from '@tabler/icons-react';
import { getOrgContext } from '@/lib/auth/orgContext';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature, FEATURE_COPY } from '@/lib/billing/features';
import { GoldmineClient } from '@/components/goldmine/GoldmineClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Database Goldmine' };

export default async function GoldminePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const tier = await resolveOrgTier(orgId);
  const locked = !hasFeature(tier, 'database_goldmine');

  return (
    <div className="p-6">
      <BorrowerHubTabs />
      <div className="flex items-center gap-2 mb-1">
        <IconPick size={22} className="text-[#C9A95C]" />
        <h1 className="text-xl font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>
          Database Goldmine™
        </h1>
      </div>
      <p className="text-sm text-[#6B7B8D] mb-5 max-w-2xl">
        Revenue hiding in your book. Ashley scans every past client weekly and surfaces who’s ripe to reactivate — with the outreach already written.
      </p>

      {locked ? (
        <div className="bg-gradient-to-r from-[#FEFDF9] to-[#FFF8ED] rounded-2xl border border-[#C9A95C]/20 px-6 py-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>{FEATURE_COPY.database_goldmine!.title}</h2>
            <span className="text-xs bg-[#C9A95C] text-white px-2 py-0.5 rounded-full">Pro</span>
          </div>
          <p className="text-sm text-[#6B7B8D] mb-4">{FEATURE_COPY.database_goldmine!.benefit}</p>
          <Link href="/settings/billing" className="inline-block bg-[#C9A95C] text-white text-sm px-5 py-2.5 rounded-lg hover:brightness-95">
            Upgrade to Pro
          </Link>
        </div>
      ) : (
        <GoldmineClient />
      )}
    </div>
  );
}
