import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { Handshake, Wand2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CoMarketingClient } from './CoMarketingClient';
import type { ReferralPartner, Profile } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Co-Marketing — AshleyIQ' };

export default async function CoMarketingPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const [{ data: partners }, { data: profiles }] = await Promise.all([
    sb
      .from('referral_partners')
      .select('*')
      .eq('active', true)
      .order('first_name'),
    sb
      .from('profiles')
      .select('id, first_name, last_name, nmls_id, email, phone, avatar_url, role, active, org_id, clerk_user_id, created_at, updated_at')
      .eq('active', true)
      .order('first_name'),
  ]);

  const totalVolume = (partners ?? []).reduce((sum, p) => sum + (p.total_volume ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#34C759]/15 flex items-center justify-center">
            <Handshake size={18} className="text-[#34C759]" />
          </div>
          <h1 className="text-[22px] font-bold text-[#1C1C1E] tracking-tight">Co-Marketing</h1>
        </div>
        <p className="text-[14px] text-[#8A8A8E] ml-11">
          Co-branded materials and shared landing pages for LO + realtor partnerships.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active Partners', value: String(partners?.length ?? 0) },
          { label: 'Total Referrals', value: String((partners ?? []).reduce((s, p) => s + p.referral_count, 0)) },
          { label: 'Closings', value: String((partners ?? []).reduce((s, p) => s + p.closed_count, 0)) },
          { label: 'Partner Volume', value: `$${(totalVolume / 1_000_000).toFixed(1)}M` },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-[22px] font-bold text-[#1C1C1E] leading-none">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Design Studio CTA */}
      <Link href="/co-marketing/studio" className="flex items-center gap-4 bg-gradient-to-r from-[#0F1D2E] to-[#1a2a3f] rounded-2xl px-5 py-4 hover:opacity-95 transition-opacity">
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Wand2 size={20} className="text-[#C9A95C]" />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-bold text-white">Design Studio</p>
          <p className="text-[13px] text-white/70">Canva-style co-branded flyers &amp; social posts — pick a template, edit live, export.</p>
        </div>
        <ArrowRight size={18} className="text-white/80" />
      </Link>

      {/* Main */}
      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-6">
        <CoMarketingClient
          partners={(partners ?? []) as ReferralPartner[]}
          profiles={(profiles ?? []) as Profile[]}
        />
      </div>

      <p className="text-[11px] text-[#C7C7CC] text-center pb-2">
        All co-marketing materials must include required disclosures. Not a commitment to lend. Subject to credit approval. Equal Housing Lender.
      </p>
    </div>
  );
}