import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Orignest <noreply@orignest.com>',
      to,
      subject,
      html,
    }),
  });
}

Deno.serve(async () => {
  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, reminders: 0 }), { status: 200 });
    }

    let totalReminders = 0;

    for (const org of orgs) {
      const { data: config } = await supabase
        .from('org_ai_config')
        .select('document_chase_enabled')
        .eq('org_id', org.id)
        .maybeSingle();

      if (config && !config.document_chase_enabled) continue;

      // Document requests older than 48 hours with status 'requested'
      const { data: overdueRequests } = await supabase
        .from('document_requests')
        .select('id,lead_id,doc_type,display_name,reminders_sent,created_at')
        .eq('org_id', org.id)
        .eq('status', 'requested')
        .lt('created_at', twoDaysAgo);

      // Group by lead
      const byLead = new Map<string, typeof overdueRequests>();
      for (const req of overdueRequests ?? []) {
        const existing = byLead.get(req.lead_id) ?? [];
        existing.push(req);
        byLead.set(req.lead_id, existing);
      }

      for (const [leadId, requests] of byLead) {
        const { data: lead } = await supabase
          .from('leads')
          .select('first_name,last_name,email,sms_consent,assigned_to')
          .eq('id', leadId)
          .single();

        if (!lead) continue;

        const docList = requests
          .map((r) => `<li>${r.display_name}</li>`)
          .join('');

        // Send borrower email reminder
        await sendEmail(
          lead.email,
          `Reminder: Documents needed for your mortgage — ${lead.first_name}`,
          `<p>Hi ${lead.first_name},</p>
           <p>We're still waiting on the following documents to continue processing your loan:</p>
           <ul>${docList}</ul>
           <p>Please upload these as soon as possible to avoid delays in your loan closing.</p>
           <p>If you have questions, please contact your loan officer directly.</p>
           <p>Thank you!</p>`,
        );

        // Update reminder count
        for (const req of requests) {
          await supabase
            .from('document_requests')
            .update({
              reminders_sent: (req.reminders_sent ?? 0) + 1,
              last_reminder_at: now.toISOString(),
            })
            .eq('id', req.id);
        }

        // If 5+ days overdue, create task for LO
        const criticalRequests = requests.filter((r) => r.created_at < fiveDaysAgo);
        if (criticalRequests.length > 0 && lead.assigned_to) {
          await supabase.from('lead_tasks').insert({
            lead_id: leadId,
            org_id: org.id,
            assigned_to: lead.assigned_to,
            title: `${criticalRequests.length} docs overdue 5+ days — ${lead.first_name} ${lead.last_name}`,
            priority: 'high',
            task_type: 'document_request',
            due_date: now.toISOString(),
          });
        }

        totalReminders++;
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'document_chase',
      status: 'completed',
      leads_processed: totalReminders,
      actions_taken: totalReminders,
      summary: `Sent document reminders for ${totalReminders} leads`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, reminders: totalReminders }), { status: 200 });
  } catch (err) {
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'document_chase',
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
