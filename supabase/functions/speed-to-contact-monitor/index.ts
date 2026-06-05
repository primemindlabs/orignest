import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  try {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Check org config
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, escalated: 0 }), { status: 200 });
    }

    let totalEscalated = 0;

    for (const org of orgs) {
      const { data: config } = await supabase
        .from('org_ai_config')
        .select('speed_to_contact_enabled')
        .eq('org_id', org.id)
        .maybeSingle();

      if (config && !config.speed_to_contact_enabled) continue;

      // Leads created >5 min ago but <60 min ago with no first contact
      const { data: uncontactedLeads } = await supabase
        .from('leads')
        .select('id,first_name,last_name,assigned_to,org_id,created_at')
        .eq('org_id', org.id)
        .eq('stage', 'new_inquiry')
        .is('last_contact_at', null)
        .lt('created_at', fiveMinAgo)
        .gte('created_at', sixtyMinAgo);

      for (const lead of uncontactedLeads ?? []) {
        if (!lead.assigned_to) continue;

        const minutesOld = Math.floor(
          (now.getTime() - new Date(lead.created_at).getTime()) / 60000,
        );

        // Create high-priority task for LO
        await supabase.from('lead_tasks').insert({
          lead_id: lead.id,
          org_id: org.id,
          assigned_to: lead.assigned_to,
          title: `URGENT: Contact ${lead.first_name} ${lead.last_name} — ${minutesOld} min with no contact`,
          priority: 'high',
          task_type: 'follow_up',
          due_date: now.toISOString(),
        });

        // Log activity
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          org_id: org.id,
          action: 'ai_alert',
          description: `Speed-to-contact alert: lead has not been contacted after ${minutesOld} minutes`,
          metadata: { agent: 'speed_to_contact', minutes_uncontacted: minutesOld },
        });

        totalEscalated++;
      }

      // >60 min leads: escalate to branch manager
      const { data: overdueLeads } = await supabase
        .from('leads')
        .select('id,first_name,last_name,assigned_to,org_id,created_at')
        .eq('org_id', org.id)
        .eq('stage', 'new_inquiry')
        .is('last_contact_at', null)
        .lt('created_at', sixtyMinAgo);

      for (const lead of overdueLeads ?? []) {
        // Notify branch manager — get manager profile
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', org.id)
          .in('role', ['branch_manager', 'admin'])
          .eq('is_active', true)
          .limit(1);

        if (!managers?.length) continue;

        await supabase.from('lead_tasks').insert({
          lead_id: lead.id,
          org_id: org.id,
          assigned_to: managers[0].id,
          title: `MANAGER ALERT: ${lead.first_name} ${lead.last_name} uncontacted >60 min`,
          priority: 'high',
          task_type: 'follow_up',
          due_date: now.toISOString(),
        });
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'speed_to_contact',
      status: 'completed',
      leads_processed: totalEscalated,
      actions_taken: totalEscalated,
      summary: `Escalated ${totalEscalated} uncontacted leads`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, escalated: totalEscalated }), { status: 200 });
  } catch (err) {
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'speed_to_contact',
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
