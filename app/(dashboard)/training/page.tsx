import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import TrainingClient, { type Course, type Enrollment } from './TrainingClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Training' };

export default async function TrainingPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const isAdmin = role === 'admin' || role === 'branch_manager';

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const profileId = (profile?.id as string) ?? '';

  let courseQ = sb.from('lms_courses').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (!isAdmin) courseQ = courseQ.eq('is_published', true);

  const [{ data: courses }, { data: enrollments }] = await Promise.all([
    courseQ,
    sb.from('lms_enrollments').select('*').eq('org_id', orgId).eq('profile_id', profileId),
  ]);

  const flatCourses: Course[] = (courses ?? []).map((c) => ({
    id: c.id as string,
    title: c.title as string,
    description: (c.description as string) ?? '',
    category: c.category as string,
    is_compliance: !!c.is_compliance,
    is_onboarding: !!c.is_onboarding,
    is_published: !!c.is_published,
    pass_threshold: Number(c.pass_threshold) || 80,
    lessons: Array.isArray(c.lessons) ? (c.lessons as Course['lessons']) : [],
    questions: Array.isArray(c.questions) ? (c.questions as Course['questions']) : [],
  }));

  const myEnrollments: Enrollment[] = (enrollments ?? []).map((e) => ({
    course_id: e.course_id as string,
    status: e.status as Enrollment['status'],
    score: e.score as number | null,
    certificate_code: e.certificate_code as string | null,
  }));

  return <TrainingClient courses={flatCourses} enrollments={myEnrollments} isAdmin={isAdmin} />;
}
