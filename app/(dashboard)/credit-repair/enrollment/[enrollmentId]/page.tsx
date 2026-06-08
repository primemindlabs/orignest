import { auth } from '@clerk/nextjs/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { EnrollmentDetailClient } from './EnrollmentDetailClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Credit Repair — Borrower' };

export default async function EnrollmentDetailPage({ params }: { params: { enrollmentId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) redirect('/dashboard');

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('*, leads(first_name, last_name, email, phone)')
    .eq('id', params.enrollmentId)
    .eq('org_id', org.id)
    .maybeSingle();
  if (!enrollment) notFound();

  const [{ data: disputes }, { data: tradelines }] = await Promise.all([
    sb.from('credit_disputes').select('id, bureau, letter_type, cycle_number, response_status, sent_at, expected_response_by, lob_status, ai_next_action').eq('enrollment_id', params.enrollmentId).order('created_at', { ascending: false }),
    sb.from('credit_tradelines').select('id, creditor_name, bureau, dispute_status, estimated_score_gain').eq('enrollment_id', params.enrollmentId).order('dispute_priority'),
  ]);

  return (
    <EnrollmentDetailClient
      enrollment={enrollment}
      disputes={disputes ?? []}
      tradelines={tradelines ?? []}
    />
  );
}