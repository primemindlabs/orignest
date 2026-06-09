/**
 * Phase 34.2 — activate a library template: copy it (+ its steps) into the org
 * as an editable, paused campaign. Idempotent per (org, source template name).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { template_id } = (await req.json().catch(() => ({}))) as { template_id?: string };
  if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: tpl } = await sb.from('campaigns').select('*').eq('id', template_id).eq('is_library_template', true).maybeSingle();
  if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // Already activated? Return the existing copy.
  const { data: existing } = await sb.from('campaigns').select('id').eq('org_id', orgId).eq('is_library_template', false).eq('name', tpl.name).maybeSingle();
  if (existing) return NextResponse.json({ campaign_id: existing.id, already: true });

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  // Milestone campaigns fire from a lead stage change — infer the trigger stage
  // from the template so the milestone DB trigger can enroll automatically.
  let triggerStage: string | null = null;
  if (tpl.type === 'milestone') {
    const n = tpl.name.toLowerCase();
    triggerStage = n.includes('clear to close') ? 'clear_to_close' : n.includes('post-close') || n.includes('welcome home') ? 'closed' : n.includes('under contract') ? 'application' : null;
  }

  const { data: created, error } = await sb
    .from('campaigns')
    .insert({
      org_id: orgId,
      created_by: profile?.id ?? null,
      name: tpl.name,
      type: tpl.type,
      category: tpl.category,
      description: tpl.description,
      status: 'paused', // LO reviews + activates
      is_library_template: false,
      auto_enroll: tpl.auto_enroll,
      audience_criteria: tpl.audience_criteria,
      exit_conditions: tpl.exit_conditions,
      total_steps: tpl.total_steps,
      trigger_stage: triggerStage,
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[activate] create failed', error);
    return NextResponse.json({ error: 'activation_failed' }, { status: 500 });
  }

  const { data: steps } = await sb.from('campaign_steps').select('step_number, delay_days, delay_hours, channel, subject, body, ai_personalize, ai_personalize_instructions, task_description').eq('campaign_id', template_id).order('step_number');
  if (steps && steps.length) {
    await sb.from('campaign_steps').insert(steps.map((s) => ({ ...s, campaign_id: created.id, org_id: orgId })));
  }

  return NextResponse.json({ campaign_id: created.id });
}
