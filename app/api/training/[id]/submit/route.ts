import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/training/[id]/submit — grade a quiz attempt.
 * Body: { answers: number[] } (selected option index per question).
 * Grades against the course's stored answer key, upserts the caller's
 * enrollment with score/status, and issues a certificate code on pass.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const answers: number[] = Array.isArray(body?.answers) ? body.answers : [];

  const sb = createAdminClient();

  const [{ data: course }, { data: profile }] = await Promise.all([
    sb.from('lms_courses').select('id, pass_threshold, questions').eq('id', params.id).eq('org_id', orgId).maybeSingle(),
    sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle(),
  ]);
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  if (!profile?.id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const questions: Array<{ correct: number }> = Array.isArray(course.questions) ? (course.questions as any[]) : [];
  const total = questions.length;
  let correct = 0;
  for (let i = 0; i < total; i++) if (answers[i] === questions[i]?.correct) correct++;
  const score = total > 0 ? Math.round((correct / total) * 100) : 100;
  const passed = score >= (Number(course.pass_threshold) || 80);

  const certificate_code = passed
    ? `CERT-${params.id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).slice(-5).toUpperCase()}`
    : null;

  const { error } = await sb
    .from('lms_enrollments')
    .upsert(
      {
        org_id: orgId,
        course_id: params.id,
        profile_id: profile.id,
        status: passed ? 'completed' : 'failed',
        score,
        certificate_code,
        completed_at: passed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,course_id,profile_id' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ score, passed, correct, total, certificate_code });
}
