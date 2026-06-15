/**
 * Create a custom (org-owned) campaign from a reviewed plan — mirrors the
 * activate route's insert, but the steps come from the user/AI rather than a
 * library template. Lands paused so the LO reviews before activating.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { CAMPAIGN_TYPES, CAMPAIGN_CATEGORIES, type CampaignStepPlan } from '@/lib/ai/campaignBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateBody {
  name?: string;
  type?: string;
  category?: string;
  description?: string;
  steps?: CampaignStepPlan[];
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const name = body.name?.trim();
  const steps = (body.steps ?? []).filter((s) => s && String(s.body ?? '').trim());
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (steps.length === 0) return NextResponse.json({ error: 'at least one step required' }, { status: 400 });

  const type = (CAMPAIGN_TYPES as readonly string[]).includes(body.type ?? '') ? body.type! : 'drip';
  const category = (CAMPAIGN_CATEGORIES as readonly string[]).includes(body.category ?? '') ? body.category! : 'nurture';

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const { data: created, error } = await sb
    .from('campaigns')
    .insert({
      org_id: orgId,
      created_by: profile?.id ?? null,
      name,
      type,
      category,
      description: body.description?.slice(0, 200) ?? null,
      status: 'paused',
      is_library_template: false,
      total_steps: steps.length,
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[campaign create] failed', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  const rows = steps.map((s, i) => ({
    campaign_id: created.id,
    org_id: orgId,
    step_number: i + 1,
    delay_days: Math.max(0, Math.round(Number(s.delay_days ?? 0))),
    delay_hours: 0,
    channel: s.channel === 'sms' ? 'sms' : 'email',
    subject: s.channel === 'sms' ? null : (s.subject ?? null),
    body: String(s.body).trim(),
    ai_personalize: s.ai_personalize !== false,
  }));
  const { error: stepErr } = await sb.from('campaign_steps').insert(rows);
  if (stepErr) {
    console.error('[campaign create] steps failed', stepErr);
    return NextResponse.json({ error: 'steps_failed', campaign_id: created.id }, { status: 500 });
  }

  return NextResponse.json({ campaign_id: created.id });
}
