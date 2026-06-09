import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);

/** GET /api/training/courses — courses for the org (LOs only see published). */
export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  let q = sb.from('lms_courses').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (!ADMIN_ROLES.has(role)) q = q.eq('is_published', true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courses: data ?? [] });
}

/** POST /api/training/courses — create a course (admin only). */
export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) return NextResponse.json({ error: 'Only admins can create courses' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const lessons = Array.isArray(body.lessons) ? body.lessons : [];
  const questions = Array.isArray(body.questions) ? body.questions : [];

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('lms_courses')
    .insert({
      org_id: orgId,
      title: body.title.trim(),
      description: body.description || null,
      category: body.category || 'general',
      is_compliance: !!body.is_compliance,
      is_onboarding: !!body.is_onboarding,
      pass_threshold: Number.isFinite(Number(body.pass_threshold)) ? Number(body.pass_threshold) : 80,
      lessons,
      questions,
      is_published: body.is_published !== false,
    })
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course: data }, { status: 201 });
}
