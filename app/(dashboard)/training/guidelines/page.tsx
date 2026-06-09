import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GuidelinesClient, type Guideline } from './GuidelinesClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Product Guidelines' };

export default async function GuidelinesPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data } = await sb.from('product_guidelines').select('id, org_id, category, title, content, tags, last_reviewed_date, next_review_date').or(`org_id.is.null,org_id.eq.${orgId}`).eq('is_active', true).order('category');
  const guidelines: Guideline[] = (data ?? []).map((g) => ({ id: g.id, category: g.category, title: g.title, content: g.content, tags: Array.isArray(g.tags) ? g.tags : [], last_reviewed_date: g.last_reviewed_date, next_review_date: g.next_review_date, is_platform: g.org_id == null }));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/training" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Training Center</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Product Guidelines</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Searchable lending guidelines — one source of truth, updated in one place. Platform guidelines apply to every org; your org can add its own.</p>
      </div>
      <GuidelinesClient guidelines={guidelines} />
    </div>
  );
}
