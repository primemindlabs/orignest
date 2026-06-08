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
      from: 'Orignest Compliance <compliance@orignest.com>',
      to,
      subject,
      html,
    }),
  });
}

Deno.serve(async () => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, alerts: 0 }), { status: 200 });
    }

    let totalAlerts = 0;

    for (const org of orgs) {
      const { data: config } = await supabase
        .from('org_ai_config')
        .select('trid_monitor_enabled')
        .eq('org_id', org.id)
        .maybeSingle();

      if (config && !config.trid_monitor_enabled) continue;

      // Leads in application/processing/underwriting
      const { data: leads } = await supabase
        .from('leads')
        .select(
          'id,first_name,last_name,assigned_to,application_date,le_sent_date,itp_received_date,cd_sent_date,closing_date,trid_status',
        )
        .eq('org_id', org.id)
        .in('stage', ['application_complete', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'])
        .not('trid_status', 'eq', 'compliant');

      for (const lead of leads ?? []) {
        if (!lead.assigned_to) continue;

        const { data: lo } = await supabase
          .from('profiles')
          .select('email,first_name,last_name')
          .eq('id', lead.assigned_to)
          .single();

        if (!lo) continue;

        const borrowerName = `${lead.first_name} ${lead.last_name}`;
        let alertSent = false;

        // LE deadline: must be sent within 3 business days of application
        if (lead.application_date && !lead.le_sent_date) {
          const appDate = new Date(lead.application_date);
          const leDeadline = new Date(appDate.getTime() + 3 * 24 * 60 * 60 * 1000);

          if (leDeadline <= tomorrow) {
            await sendEmail(
              lo.email,
              `URGENT: TRID LE Deadline — ${borrowerName}`,
              `<p>Hi ${lo.first_name},</p>
               <p><strong>URGENT TRID COMPLIANCE ALERT</strong></p>
               <p>The Loan Estimate for <strong>${borrowerName}</strong> must be sent by <strong>${leDeadline.toLocaleDateString()}</strong>. Application was received on ${new Date(lead.application_date).toLocaleDateString()}.</p>
               <p>Please send the Loan Estimate immediately to maintain TRID compliance.</p>
               <p><a href="${Deno.env.get('NEXT_PUBLIC_APP_URL')}/leads/${lead.id}">View Lead</a></p>`,
            );

            await supabase.from('lead_activities').insert({
              lead_id: lead.id,
              org_id: org.id,
              action: 'trid_alert',
              description: `TRID LE deadline alert sent — deadline ${leDeadline.toLocaleDateString()}`,
              metadata: { agent: 'trid_monitor', type: 'le_deadline' },
            });

            alertSent = true;
            totalAlerts++;
          }
        }

        // CD deadline: must be sent at least 3 business days before closing
        if (lead.closing_date && lead.le_sent_date && !lead.cd_sent_date) {
          const closeDate = new Date(lead.closing_date);
          const cdDeadline = new Date(closeDate.getTime() - 3 * 24 * 60 * 60 * 1000);

          if (cdDeadline <= in48Hours) {
            await sendEmail(
              lo.email,
              `URGENT: TRID CD Deadline — ${borrowerName}`,
              `<p>Hi ${lo.first_name},</p>
               <p><strong>URGENT TRID COMPLIANCE ALERT</strong></p>
               <p>The Closing Disclosure for <strong>${borrowerName}</strong> must be sent by <strong>${cdDeadline.toLocaleDateString()}</strong> to comply with the 3-business-day rule before closing on ${new Date(lead.closing_date).toLocaleDateString()}.</p>
               <p><a href="${Deno.env.get('NEXT_PUBLIC_APP_URL')}/leads/${lead.id}">View Lead</a></p>`,
            );

            if (!alertSent) {
              await supabase.from('lead_activities').insert({
                lead_id: lead.id,
                org_id: org.id,
                action: 'trid_alert',
                description: `TRID CD deadline alert sent — deadline ${cdDeadline.toLocaleDateString()}`,
                metadata: { agent: 'trid_monitor', type: 'cd_deadline' },
              });
              totalAlerts++;
            }
          }
        }
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'trid_monitor',
      status: 'completed',
      leads_processed: totalAlerts,
      actions_taken: totalAlerts,
      summary: `Sent ${totalAlerts} TRID deadline alerts`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, alerts: totalAlerts }), { status: 200 });
  } catch (err) {
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'trid_monitor',
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
