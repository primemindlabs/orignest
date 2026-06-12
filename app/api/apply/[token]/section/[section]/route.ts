// Phase 105 — public autosave for one section (no auth; token-gated). Only fields in
// the section allowlist are persisted. Best-effort sync to application_sessions (P97).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SECTION_FIELDS, computeCompletionPct, type ApplicationSection } from '@/types/apply';

type Ctx = { params: Promise<{ token: string; section: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { token, section } = await params;
  const allowed = SECTION_FIELDS[section as ApplicationSection];
  if (!allowed) return NextResponse.json({ error: 'Unknown section' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const safeBody = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const sb = createAdminClient();
  const { data: app } = await sb
    .from('applications')
    .select('*')
    .eq('token', token)
    .neq('status', 'submitted')
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged = { ...app, ...safeBody };
  const completionPct = computeCompletionPct(merged);

  await sb
    .from('applications')
    .update({ ...safeBody, status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('token', token);

  await sb
    .from('application_section_progress')
    .upsert({ application_id: app.id, section_name: section, completed: false });

  // Best-effort abandon-recovery session sync (keyed by token; dormant feature).
  try {
    await sb
      .from('application_sessions')
      .update({
        last_section_completed: section,
        completion_pct: completionPct,
        last_activity_at: new Date().toISOString(),
      })
      .eq('lead_id', app.lead_id);
  } catch {
    /* sessions are optional */
  }

  return NextResponse.json({ ok: true, completion_pct: completionPct });
}
