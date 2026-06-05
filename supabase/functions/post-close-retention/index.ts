import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CHECKPOINTS = [30, 60, 90, 180, 365]; // days post-close

async function generateCheckInMessage(
  borrowerName: string,
  daysPostClose: number,
  loanType: string,
  loName: string,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system:
      'You are a mortgage loan officer writing a warm, personal check-in message to a past borrower. Keep it brief (2-3 sentences), friendly, non-salesy. No markdown.',
    messages: [
      {
        role: 'user',
        content: `Write a ${daysPostClose}-day post-close check-in message to ${borrowerName}. Their loan type was ${loanType}. LO name: ${loName}. Be genuine and personal.`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : `Hi ${borrowerName}, just checking in to see how things are going!`;
}

Deno.serve(async () => {
  try {
    const today = new Date();
    let totalOutreach = 0;

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, outreach: 0 }), { status: 200 });
    }

    for (const org of orgs) {
      const { data: config } = await supabase
        .from('org_ai_config')
        .select('post_close_retention_enabled')
        .eq('org_id', org.id)
        .maybeSingle();

      if (config && !config.post_close_retention_enabled) continue;

      // Get closed leads
      const { data: closedLeads } = await supabase
        .from('leads')
        .select('id,first_name,last_name,loan_type,assigned_to,closing_date,email')
        .eq('org_id', org.id)
        .eq('stage', 'closed')
        .not('closing_date', 'is', null);

      for (const lead of closedLeads ?? []) {
        if (!lead.closing_date) continue;

        const closeDate = new Date(lead.closing_date);
        const daysPostClose = Math.floor(
          (today.getTime() - closeDate.getTime()) / (24 * 60 * 60 * 1000),
        );

        // Check if today is a checkpoint day (±1 day tolerance)
        const isCheckpoint = CHECKPOINTS.some((cp) => Math.abs(daysPostClose - cp) <= 1);
        if (!isCheckpoint) continue;

        const matchedCheckpoint = CHECKPOINTS.find((cp) => Math.abs(daysPostClose - cp) <= 1);
        if (!matchedCheckpoint) continue;

        // Check we haven't already sent this checkpoint
        const { data: existingActivity } = await supabase
          .from('lead_activities')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('action', 'post_close_checkin')
          .eq('metadata->>checkpoint_days', String(matchedCheckpoint))
          .maybeSingle();

        if (existingActivity) continue;

        // Get LO info
        const loId = lead.assigned_to;
        if (!loId) continue;

        const { data: lo } = await supabase
          .from('profiles')
          .select('first_name,last_name')
          .eq('id', loId)
          .single();

        if (!lo) continue;

        const message = await generateCheckInMessage(
          lead.first_name,
          matchedCheckpoint,
          lead.loan_type ?? 'conventional',
          `${lo.first_name} ${lo.last_name}`,
        );

        // Create draft task for LO review (not auto-sent)
        await supabase.from('lead_tasks').insert({
          lead_id: lead.id,
          org_id: org.id,
          assigned_to: loId,
          title: `Post-close check-in: ${lead.first_name} ${lead.last_name} (${matchedCheckpoint}-day)`,
          description: `Draft message (review before sending):\n\n${message}`,
          priority: 'low',
          task_type: 'follow_up',
          due_date: today.toISOString(),
        });

        // Log activity
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          org_id: org.id,
          action: 'post_close_checkin',
          description: `Post-close ${matchedCheckpoint}-day check-in draft created for LO review`,
          metadata: {
            agent: 'post_close_retention',
            checkpoint_days: matchedCheckpoint,
            draft_message: message,
          },
        });

        totalOutreach++;
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'post_close_retention',
      status: 'completed',
      leads_processed: totalOutreach,
      actions_taken: totalOutreach,
      summary: `Created ${totalOutreach} post-close check-in drafts for LO review`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, outreach: totalOutreach }), { status: 200 });
  } catch (err) {
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'post_close_retention',
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
