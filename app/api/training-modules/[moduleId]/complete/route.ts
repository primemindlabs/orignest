/**
 * Phase 30.10 — record a training module completion (INSERT-only audit).
 * Path is /api/training-modules/* (the existing /api/training/[courseId] LMS
 * route fixes that dynamic slug to courseId, so this lives on a separate path).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { moduleId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { score?: number; passed?: boolean };
  const score = Math.max(0, Math.min(100, Math.round(Number(body.score) || 0)));

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: mod } = await sb.from('training_modules').select('id').eq('id', params.moduleId).eq('org_id', orgId).maybeSingle();
  if (!mod) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error } = await sb.from('training_completions').insert({
    module_id: params.moduleId,
    user_id: profile.id,
    org_id: orgId,
    score,
    passed: body.passed ?? score >= 80,
  });
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
