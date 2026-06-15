import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeRole } from '@/lib/navigation/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — manager compliance view: per-LO completion of REQUIRED training items.
export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const r = normalizeRole(role);
  if (r !== 'admin' && r !== 'branch_manager') return NextResponse.json({ error: 'Managers only' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: required }, { data: members }] = await Promise.all([
    sb.from('training_items').select('id, title').eq('org_id', orgId).eq('is_required', true).eq('is_published', true).order('created_at'),
    sb.from('profiles').select('id, first_name, last_name').eq('org_id', orgId).eq('active', true).order('first_name'),
  ]);

  const requiredItems = required ?? [];
  const requiredIds = new Set(requiredItems.map((i) => i.id as string));

  const completedByUser: Record<string, Set<string>> = {};
  if (requiredIds.size > 0) {
    const { data: comps } = await sb
      .from('training_item_completions')
      .select('training_item_id, user_id')
      .eq('org_id', orgId)
      .in('training_item_id', Array.from(requiredIds));
    for (const c of comps ?? []) {
      const uid = c.user_id as string;
      (completedByUser[uid] ??= new Set()).add(c.training_item_id as string);
    }
  }

  const rows = (members ?? []).map((m) => {
    const done = completedByUser[m.id as string] ?? new Set<string>();
    return {
      user_id: m.id,
      name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Teammate',
      completed_ids: Array.from(done),
      completed_count: done.size,
      rate: requiredIds.size ? Math.round((done.size / requiredIds.size) * 100) : 100,
    };
  });

  return NextResponse.json({ required_items: requiredItems, members: rows });
}

// POST — Phase 136: record per-lesson progress in the lms_courses player.
// Body: { course_id, lesson_index, completed }. Upserts (or clears) a lesson_progress row.
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { course_id?: string; lesson_index?: number; completed?: boolean };
  const courseId = body.course_id;
  const lessonIndex = body.lesson_index;
  if (!courseId || typeof lessonIndex !== 'number' || lessonIndex < 0) {
    return NextResponse.json({ error: 'course_id and lesson_index are required' }, { status: 400 });
  }
  const completed = body.completed !== false;

  const sb = createAdminClient();

  const { data: course } = await sb.from('lms_courses').select('id').eq('id', courseId).eq('org_id', orgId).maybeSingle();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const profileId = profile?.id as string | undefined;
  if (!profileId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  if (completed) {
    const { error } = await sb
      .from('lesson_progress')
      .upsert(
        { org_id: orgId, profile_id: profileId, course_id: courseId, lesson_index: lessonIndex, completed: true, completed_at: new Date().toISOString() },
        { onConflict: 'org_id,profile_id,course_id,lesson_index' },
      );
    if (error) { console.error('[training/progress] upsert', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  } else {
    await sb.from('lesson_progress').delete().eq('org_id', orgId).eq('profile_id', profileId).eq('course_id', courseId).eq('lesson_index', lessonIndex);
  }

  // First lesson activity moves the enrollment into 'in_progress' (never downgrades a pass).
  await sb
    .from('lms_enrollments')
    .upsert(
      { org_id: orgId, course_id: courseId, profile_id: profileId, status: 'in_progress' },
      { onConflict: 'org_id,course_id,profile_id', ignoreDuplicates: true },
    )
    .then(() => undefined, () => undefined);

  return NextResponse.json({ ok: true });
}
