import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

interface ExecuteRequest {
  leadId: string;
  triggerType: string;
  payload?: Record<string, unknown>;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AshleyIQ <noreply@ashleyiq.com>',
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ExecuteRequest;
    const { leadId, triggerType, payload } = body;

    if (!leadId || !triggerType) {
      return NextResponse.json({ error: 'leadId and triggerType are required' }, { status: 400 });
    }

    const sb = createAdminClient();

    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .single();

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // Load matching active automations for this org + trigger type
    const { data: automations } = await sb
      .from('automations')
      .select('*')
      .eq('org_id', org.id)
      .eq('active', true)
      .eq('trigger_type', triggerType);

    if (!automations?.length) {
      return NextResponse.json({ executed: 0 });
    }

    // Load lead data
    const { data: lead } = await sb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('org_id', org.id)
      .single();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const results: Array<{ automationId: string; status: string; actionTaken: string }> = [];

    for (const automation of automations) {
      const actionConfig = automation.action_config as Record<string, unknown>;
      let actionTaken = '';
      let status = 'success';

      try {
        switch (automation.action_type) {
          case 'send_email': {
            if (!lead.email) { status = 'skipped'; actionTaken = 'No email on lead'; break; }
            const subject = (actionConfig.subject as string) ?? 'Message from your loan officer';
            const bodyTemplate = (actionConfig.body as string) ?? 'Hello {{first_name}},\n\nPlease reach out to us.';
            const html = bodyTemplate
              .replace(/{{first_name}}/g, lead.first_name)
              .replace(/{{last_name}}/g, lead.last_name)
              .replace(/{{full_name}}/g, lead.full_name);
            await sendEmail(lead.email, subject, `<p>${html.replace(/\n/g, '<br>')}</p>`);
            actionTaken = `Email sent: ${subject}`;
            break;
          }
          case 'create_task': {
            await sb.from('lead_tasks').insert({
              lead_id: leadId,
              org_id: org.id,
              assigned_to: lead.assigned_to ?? null,
              title: (actionConfig.task_title as string) ?? 'Follow up with lead',
              priority: (actionConfig.priority as string) ?? 'medium',
              task_type: 'follow_up',
              due_date: new Date().toISOString(),
            });
            actionTaken = `Task created: ${actionConfig.task_title}`;
            break;
          }
          case 'change_stage': {
            const newStage = actionConfig.stage as string;
            if (newStage) {
              await sb.from('leads').update({ stage: newStage }).eq('id', leadId);
              actionTaken = `Stage changed to: ${newStage}`;
            } else {
              status = 'skipped';
              actionTaken = 'No stage specified';
            }
            break;
          }
          case 'assign_lead': {
            const assignTo = actionConfig.assign_to as string;
            if (assignTo) {
              await sb.from('leads').update({ assigned_to: assignTo }).eq('id', leadId);
              actionTaken = `Lead assigned to profile: ${assignTo}`;
            } else {
              status = 'skipped';
              actionTaken = 'No assignee specified';
            }
            break;
          }
          case 'notify_lo': {
            if (lead.assigned_to) {
              await sb.from('lead_tasks').insert({
                lead_id: leadId,
                org_id: org.id,
                assigned_to: lead.assigned_to,
                title: (actionConfig.message as string) ?? `Automation: ${triggerType}`,
                priority: 'medium',
                task_type: 'other',
                due_date: new Date().toISOString(),
              });
              actionTaken = `LO notified: ${actionConfig.message}`;
            } else {
              status = 'skipped';
              actionTaken = 'No LO assigned';
            }
            break;
          }
          case 'notify_manager': {
            const { data: managers } = await sb
              .from('profiles')
              .select('id')
              .eq('org_id', org.id)
              .in('role', ['branch_manager', 'admin'])
              .eq('is_active', true)
              .limit(1);
            if (managers?.[0]) {
              await sb.from('lead_tasks').insert({
                lead_id: leadId,
                org_id: org.id,
                assigned_to: managers[0].id,
                title: (actionConfig.message as string) ?? `Manager alert: ${triggerType}`,
                priority: 'high',
                task_type: 'other',
                due_date: new Date().toISOString(),
              });
              actionTaken = 'Manager notified';
            } else {
              status = 'skipped';
              actionTaken = 'No manager found';
            }
            break;
          }
          default: {
            status = 'skipped';
            actionTaken = `Unknown action type: ${automation.action_type}`;
          }
        }
      } catch (actionErr) {
        status = 'failed';
        actionTaken = actionErr instanceof Error ? actionErr.message : 'Action failed';
      }

      // Log execution
      await sb.from('automation_executions').insert({
        automation_id: automation.id,
        org_id: org.id,
        lead_id: leadId,
        status,
        action_taken: actionTaken,
        result: { payload, triggerType },
      });

      // Update run count
      await sb
        .from('automations')
        .update({ run_count: (automation.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
        .eq('id', automation.id);

      results.push({ automationId: automation.id, status, actionTaken });
    }

    return NextResponse.json({ executed: results.length, results });
  } catch (err) {
    console.error('[automations/execute]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Execution error' },
      { status: 500 },
    );
  }
}
