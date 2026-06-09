import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { Share2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SocialClient } from './SocialClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Social Media — AshleyIQ' };

export default async function SocialPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const { data: savedPosts } = await sb
    .from('social_posts')
    .select('id, platform, content_type, body, hashtags, status, scheduled_at, compliance_flag, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const posts = savedPosts ?? [];
  const scheduled = posts.filter(p => p.status === 'scheduled').length;
  const posted = posts.filter(p => p.status === 'posted').length;
  const drafts = posts.filter(p => p.status === 'draft').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#5856D6]/15 flex items-center justify-center">
              <Share2 size={18} className="text-[#5856D6]" />
            </div>
            <h1 className="text-[22px] font-bold text-[#1C1C1E] tracking-tight">Social Media</h1>
          </div>
          <p className="text-[14px] text-[#8A8A8E] ml-11">
            AI-powered content creation for LinkedIn, Instagram, Facebook, and X.
          </p>
        </div>
        <Link href="/social/ideas" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium border border-black/[0.08] text-[#1C1C1E] hover:bg-black/[0.03] transition-colors">
          <Sparkles size={14} className="text-[#C9A95C]" /> Content Studio
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: String(posts.length) },
          { label: 'Scheduled', value: String(scheduled) },
          { label: 'Posted', value: String(posted) },
          { label: 'Drafts', value: String(drafts) },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-[22px] font-bold text-[#1C1C1E] leading-none">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-6">
        <SocialClient savedPosts={posts as Parameters<typeof SocialClient>[0]['savedPosts']} />
      </div>

      <p className="text-[11px] text-[#C7C7CC] text-center pb-2">
        All social content should be reviewed before publishing. Not a commitment to lend. Subject to credit approval.
      </p>
    </div>
  );
}