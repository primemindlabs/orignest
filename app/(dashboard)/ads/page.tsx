import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { Megaphone, Sparkles, Users, TrendingUp, Library, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdCenterClient } from './AdCenterClient';
import type { Profile } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ad Center — AshleyIQ' };

export default async function AdCenterPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const [{ data: org }, { data: landingPages }, { data: profiles }] = await Promise.all([
    sb.from('organizations').select('id, name').eq('clerk_org_id', orgId).maybeSingle(),
    sb.from('landing_pages').select('id, slug, headline, active, page_views, leads_captured, created_at').order('created_at', { ascending: false }),
    sb.from('profiles').select('id, first_name, last_name, nmls_id, email, phone').eq('active', true).order('first_name'),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/15 flex items-center justify-center">
              <Megaphone size={18} className="text-[#C9A95C]" />
            </div>
            <h1 className="text-[22px] font-bold text-[#1C1C1E] tracking-tight">Ad Center</h1>
          </div>
          <p className="text-[14px] text-[#8A8A8E] ml-11">
            Create mortgage ad campaigns, manage creative assets, and build LO landing pages.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active Campaigns', value: '—', sub: 'No active campaigns' },
          { label: 'Leads This Month', value: '—', sub: 'From all campaigns' },
          { label: 'Landing Pages', value: String(landingPages?.length ?? 0), sub: 'Total published' },
          { label: 'Avg. Cost per Lead', value: '—', sub: 'Across all platforms' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-[22px] font-bold text-[#1C1C1E] leading-none">{stat.value}</p>
            <p className="text-[11px] text-[#C7C7CC] mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Phase 33 — compliant builder + library + co-marketing + attribution entry points */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/ads/builder" className="flex items-center gap-3 bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5 hover:border-[#C9A95C]/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/15 flex items-center justify-center flex-shrink-0"><Sparkles size={17} className="text-[#C9A95C]" /></div>
          <div><p className="text-[14px] font-semibold text-[#1C1C1E]">Compliant Ad Builder</p><p className="text-[12px] text-[#8A8A8E]">AI copy + compliance review + export</p></div>
        </Link>
        <Link href="/ads/library" className="flex items-center gap-3 bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5 hover:border-[#C9A95C]/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/15 flex items-center justify-center flex-shrink-0"><Library size={17} className="text-[#C9A95C]" /></div>
          <div><p className="text-[14px] font-semibold text-[#1C1C1E]">Creative Library</p><p className="text-[12px] text-[#8A8A8E]">Saved ad copy — reuse &amp; duplicate</p></div>
        </Link>
        <Link href="/ads/co-marketing" className="flex items-center gap-3 bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5 hover:border-[#C9A95C]/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/15 flex items-center justify-center flex-shrink-0"><Users size={17} className="text-[#C9A95C]" /></div>
          <div><p className="text-[14px] font-semibold text-[#1C1C1E]">Co-Marketing</p><p className="text-[12px] text-[#8A8A8E]">RESPA-compliant realtor partner ads</p></div>
        </Link>
        <Link href="/ads/attribution" className="flex items-center gap-3 bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5 hover:border-[#C9A95C]/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-[#C9A95C]/15 flex items-center justify-center flex-shrink-0"><TrendingUp size={17} className="text-[#C9A95C]" /></div>
          <div><p className="text-[14px] font-semibold text-[#1C1C1E]">Attribution</p><p className="text-[12px] text-[#8A8A8E]">Leads & ROAS by campaign</p></div>
        </Link>
      </div>

      {/* Design Studio CTA — Canva-like visual ad creative */}
      <Link href="/social/studio" className="flex items-center gap-4 bg-gradient-to-r from-[#0F1D2E] to-[#1a2a3f] rounded-2xl px-5 py-4 hover:opacity-95 transition-opacity">
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Wand2 size={20} className="text-[#C9A95C]" />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-bold text-white">Design Studio</p>
          <p className="text-[13px] text-white/70">Canva-style ad creative — pick a template, edit live, brand it, and export.</p>
        </div>
        <Sparkles size={18} className="text-white/80" />
      </Link>

      {/* Main content */}
      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-6">
        <AdCenterClient
          landingPages={landingPages ?? []}
          profiles={(profiles ?? []) as Profile[]}
          orgSlug={org?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'org'}
        />
      </div>

      {/* Compliance footer */}
      <p className="text-[11px] text-[#C7C7CC] text-center pb-2">
        All ad copy generated by AshleyIQ AI must be reviewed for compliance before publishing.
        Not a commitment to lend. Subject to credit approval. Equal Housing Lender.
      </p>
    </div>
  );
}