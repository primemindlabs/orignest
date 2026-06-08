import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://app.orignest.com';

async function executeAutomation(
  automationId: string,
  orgId: string,
  leadId: string,
  triggerType: string,
  actionType: string,
  actionConfig: Record<string, unknown>,
): Promise<void> {
  let actionTaken = '';
  let success = true;
  let result: Record<string, unknown> = {};

  try {
    switch (actionType) {
      case 'create_task': {
        const { data: lead } = await supabase
          .from('leads')
          .select('assigned_to')
          .eq('id', leadId)
          .single();

        await supabase.from('lead_tasks').insert({
          lead_id: leadId,
          org_id: orgId,
          assigned_to: lead?.assigned_to ?? null,
          title: (actionConfig.task_title as string) ?? 'Follow up',
          priority: (actionConfig.priority as string) ?? 'medium',
          task_type: 'follow_up',
          due_date: new Date().toISOString(),
        });
        actionTaken = `Created task: ${actionConfig.task_title}`;
        break;
      }
      case 'notify_lo': {
        const { data: lead } = await supabase
          .from('leads')
          .select('assigned_to,first_name,last_name')
          .eq('id', leadId)
          .single();

        if (lead?.assigned_to) {
          await supabase.from('lead_tasks').insert({
            lead_id: leadId,
            org_id: orgId,
            assigned_to: lead.assigned_to,
            title: (actionConfig.message as string) ?? `Automation triggered: ${triggerType}`,
            priority: 'medium',
            task_type: 'other',
            due_date: new Date().toISOString(),
          });
        }
        actionTaken = `Notified LO: ${actionConfig.message}`;
        break;
      }
      case 'change_stage': {
        const newStage = actionConfig.stage as string;
        if (newStage) {
          await supabase.from('leads').update({ stage: newStage }).eq('id', leadId);
          await supabase.from('lead_activities').insert({
            lead_id: leadId,
            org_id: orgId,
            action: 'stage_changed',
            description: `Stage changed to ${newStage} by automation`,
            metadata: { automation_id: automationId },
          });
          actionTaken = `Changed stage to: ${newStage}`;
        }
        break;
      }
      case 'enroll_campaign': {
        // Mark in lead activities — actual campaign enrollment handled by campaign system
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          org_id: orgId,
          action: 'campaign_enrolled',
          description: `Enrolled in campaign: ${actionConfig.campaign_name}`,
          metadata: { campaign_id: actionConfig.campaign_id, automation_id: automationId },
        });
        actionTaken = `Enrolled in campaign: ${actionConfig.campaign_name}`;
        break;
      }
      case 'ai_analysis': {
        // Trigger deal analysis via internal API
        await fetch(`${APP_URL}/api/ai/deal-analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ leadId }),
        });
        actionTaken = 'Triggered AI deal analysis';
        break;
      }
      default: {
        actionTaken = `Action type ${actionType} logged (external execution required)`;
      }
    }

    result = { success: true, actionTaken };
  } catch (err) {
    success = false;
    result = { error: err instanceof Error ? err.message : String(err) };
    actionTaken = `Failed: ${actionType}`;
  }

  // Log execution
  await supabase.from('automation_executions').insert({
    automation_id: automationId,
    org_id: orgId,
    lead_id: leadId,
    status: success ? 'success' : 'failed',
    action_taken: actionTaken,
    result,
  });

  // Increment run count
  await supabase.rpc('increment_automation_run_count', { automation_id: automationId }).catch(() => {
    // Fallback if RPC not available
    return supabase
      .from('automations')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', automationId);
  });
}

Deno.serve(async () => {
  try {
    const now = new Date();

    const { data: automations } = await supabase
      .from('automations')
      .select('id,org_id,trigger_type,trigger_config,action_type,action_config')
      .eq('active', true)
      .in('trigger_type', [
        'no_contact_hours',
        'anniversary',
        'birthday',
        'closing_date_approaching',
        'rate_lock_expiring',
      ]);

    if (!automations?.length) {
      return new Response(JSON.stringify({ ok: true, executed: 0 }), { status: 200 });
    }

    let totalExecuted = 0;

    for (const automation of automations) {
      const config = automation.trigger_config as Record<string, unknown>;

      switch (automation.trigger_type) {
        case 'no_contact_hours': {
          const hours = (config.hours as number) ?? 24;
          const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

          const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('org_id', automation.org_id)
            .not('stage', 'in', '("closed","dead")')
            .or(`last_contact_at.lt.${cutoff},last_contact_at.is.null`)
            .lt('created_at', cutoff);

          for (const lead of leads ?? []) {
            await executeAutomation(
              automation.id,
              automation.org_id,
              lead.id,
              automation.trigger_type,
              automation.action_type,
              automation.action_config as Record<string, unknown>,
            );
            totalExecuted++;
          }
          break;
        }

        case 'closing_date_approaching': {
          const daysAhead = (config.days as number) ?? 7;
          const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
          const futureDateStr = futureDate.toISOString().split('T')[0];
          const todayStr = now.toISOString().split('T')[0];

          const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('org_id', automation.org_id)
            .not('stage', 'in', '("closed","dead")')
            .not('closing_date', 'is', null)
            .lte('closing_date', futureDateStr)
            .gte('closing_date', todayStr);

          for (const lead of leads ?? []) {
            await executeAutomation(
              automation.id,
              automation.org_id,
              lead.id,
              automation.trigger_type,
              automation.action_type,
              automation.action_config as Record<string, unknown>,
            );
            totalExecuted++;
          }
          break;
        }

        case 'rate_lock_expiring': {
          const daysAhead = (config.days as number) ?? 3;
          const expiryWindow = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

          const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('org_id', automation.org_id)
            .eq('rate_locked', true)
            .not('rate_lock_expires_at', 'is', null)
            .lte('rate_lock_expires_at', expiryWindow)
            .gte('rate_lock_expires_at', now.toISOString());

          for (const lead of leads ?? []) {
            await executeAutomation(
              automation.id,
              automation.org_id,
              lead.id,
              automation.trigger_type,
              automation.action_type,
              automation.action_config as Record<string, unknown>,
            );
            totalExecuted++;
          }
          break;
        }

        case 'anniversary': {
          // Leads closed exactly 1 year ago (±3 days window)
          const oneYearAgo = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate(),
          );
          const windowStart = new Date(oneYearAgo.getTime() - 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          const windowEnd = new Date(oneYearAgo.getTime() + 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('org_id', automation.org_id)
            .eq('stage', 'closed')
            .not('closing_date', 'is', null)
            .gte('closing_date', windowStart)
            .lte('closing_date', windowEnd);

          for (const lead of leads ?? []) {
            await executeAutomation(
              automation.id,
              automation.org_id,
              lead.id,
              automation.trigger_type,
              automation.action_type,
              automation.action_config as Record<string, unknown>,
            );
            totalExecuted++;
          }
          break;
        }
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'compliance_scan',
      status: 'completed',
      leads_processed: totalExecuted,
      actions_taken: totalExecuted,
      summary: `Automation runner: executed ${totalExecuted} automations`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, executed: totalExecuted }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
