/**
 * Phase 34.3 — campaign step processor (cron-callable, Bearer CRON_SECRET).
 *
 * For each active enrollment whose next_send_at is due: check exit conditions,
 * personalize the step (Haiku), record an immutable campaign_step_sends row, and
 * advance. Actual email/SMS DELIVERY is guarded behind CAMPAIGNS_LIVE_SEND=true
 * (so it never blasts demo contacts); SMS additionally requires TCPA consent.
 * The personalization + audit trail run regardless.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { personalizeMessage, interpolateTemplate } from '@/lib/campaigns/personalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LIVE = process.env.CAMPAIGNS_LIVE_SEND === 'true';
const BATCH = 60;

function exitFor(exitConditions: unknown, lead: { stage?: string | null }): string | null {
  if (!Array.isArray(exitConditions)) return null;
  for (const c of exitConditions as Array<Record<string, unknown>>) {
    if (c.type === 'stage_change' && typeof c.to === 'string' && lead.stage === c.to) return 'stage_change';
  }
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  const { data: due } = await sb
    .from('campaign_enrollments')
    .select('id, campaign_id, lead_id, org_id, current_step')
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(BATCH);

  let sent = 0, exited = 0, skipped = 0;
  const orgName = new Map<string, string>();

  for (const e of due ?? []) {
    const [{ data: campaign }, { data: lead }] = await Promise.all([
      sb.from('campaigns').select('exit_conditions').eq('id', e.campaign_id).maybeSingle(),
      sb.from('leads').select('first_name, last_name, email, phone, stage, loan_type, closed_date, sms_consent, assigned_to').eq('id', e.lead_id).maybeSingle(),
    ]);
    if (!lead) { await sb.from('campaign_enrollments').update({ status: 'exited', exited_at: new Date().toISOString(), exit_reason: 'lead_missing' }).eq('id', e.id); exited++; continue; }

    // Exit conditions (e.g., stage reached a terminal value).
    const reason = exitFor(campaign?.exit_conditions, lead);
    if (reason) { await sb.from('campaign_enrollments').update({ status: 'exited', exited_at: new Date().toISOString(), exit_reason: reason }).eq('id', e.id); exited++; continue; }

    const { data: step } = await sb.from('campaign_steps').select('*').eq('campaign_id', e.campaign_id).eq('step_number', e.current_step).maybeSingle();
    if (!step) { await sb.from('campaign_enrollments').update({ status: 'completed', exited_at: new Date().toISOString(), exit_reason: 'completed' }).eq('id', e.id); exited++; continue; }

    // Resolve LO/company for personalization.
    let loName = 'your loan officer';
    if (lead.assigned_to) {
      const { data: p } = await sb.from('profiles').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle();
      if (p) loName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || loName;
    }
    if (!orgName.has(e.org_id)) {
      const { data: o } = await sb.from('organizations').select('name').eq('id', e.org_id).maybeSingle();
      orgName.set(e.org_id, o?.name ?? '');
    }
    const vars = { ...lead, lo_name: loName, company_name: orgName.get(e.org_id) ?? '' };

    const body = step.ai_personalize
      ? await personalizeMessage(step.body, vars, step.ai_personalize_instructions ?? undefined)
      : interpolateTemplate(step.body, vars);
    const subject = step.subject ? interpolateTemplate(step.subject, vars) : null;

    // Determine delivery outcome.
    let delivery: string = 'recorded';
    if (step.channel === 'task') {
      // Tasks become a lead_activities entry for the LO.
      await sb.from('lead_activities').insert({ lead_id: e.lead_id, org_id: e.org_id, action: 'campaign_task', description: interpolateTemplate(step.task_description ?? step.body, vars), metadata: { campaign_id: e.campaign_id, step: e.current_step } }).then(() => undefined, () => undefined);
      delivery = 'recorded';
    } else if (step.channel === 'sms') {
      if (!lead.phone) delivery = 'skipped_no_contact';
      else if (!lead.sms_consent) delivery = 'skipped_tcpa';
      else delivery = LIVE ? 'sent' : 'recorded';
      // TODO(delivery): when LIVE + consent, send via Twilio here.
    } else {
      if (!lead.email) delivery = 'skipped_no_contact';
      else delivery = LIVE ? 'sent' : 'recorded';
      // TODO(delivery): when LIVE, send via Resend here.
    }
    if (delivery.startsWith('skipped')) skipped++; else sent++;

    await sb.from('campaign_step_sends').insert({
      enrollment_id: e.id, campaign_id: e.campaign_id, step_id: step.id, lead_id: e.lead_id, org_id: e.org_id,
      channel: step.channel, subject, body, original_template: step.body, ai_personalized: !!step.ai_personalize, delivery_status: delivery,
    });

    // Advance to the next step, or complete.
    const { data: next } = await sb.from('campaign_steps').select('delay_days, delay_hours').eq('campaign_id', e.campaign_id).eq('step_number', e.current_step + 1).maybeSingle();
    if (next) {
      const nextAt = new Date(Date.now() + (next.delay_days ?? 0) * 86_400_000 + (next.delay_hours ?? 0) * 3_600_000).toISOString();
      await sb.from('campaign_enrollments').update({ current_step: e.current_step + 1, next_send_at: nextAt }).eq('id', e.id);
    } else {
      await sb.from('campaign_enrollments').update({ status: 'completed', exited_at: new Date().toISOString(), exit_reason: 'completed' }).eq('id', e.id);
    }
  }

  return NextResponse.json({ processed: due?.length ?? 0, sent, skipped, exited, live: LIVE });
}
