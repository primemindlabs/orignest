import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Content360Client } from './Content360Client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Content 360' };

export default async function Content360Page({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, last_name').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href={`/leads/${params.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> {lead.first_name} {lead.last_name}</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Content 360</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Every email, text, video, and flyer that has touched this contact — with an engagement score and AI-recommended next-best content.</p>
      </div>
      <Content360Client contactId={params.id} contactType="lead" />
    </div>
  );
}
