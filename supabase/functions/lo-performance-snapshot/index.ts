import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  try {
    const today = new Date();
    const snapshotDate = today.toISOString().split('T')[0];
    const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, snapshots: 0 }), { status: 200 });
    }

    let totalSnapshots = 0;

    for (const org of orgs) {
      const { data: los } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', org.id)
        .eq('is_active', true)
        .in('role', ['loan_officer', 'branch_manager', 'admin']);

      for (const lo of los ?? []) {
        // Pipeline leads
        const { data: pipelineLeads } = await supabase
          .from('leads')
          .select('id,loan_amount,ai_score,last_contact_at,trid_status,source,stage,closing_date,created_at')
          .eq('org_id', org.id)
          .eq('assigned_to', lo.id)
          .not('stage', 'in', '("closed","dead")');

        // Closed MTD
        const { data: closedMTD } = await supabase
          .from('leads')
          .select('id,loan_amount')
          .eq('org_id', org.id)
          .eq('assigned_to', lo.id)
          .eq('stage', 'closed')
          .gte('updated_at', mtdStart);

        // Referrals MTD
        const { data: referralsMTD } = await supabase
          .from('leads')
          .select('id')
          .eq('org_id', org.id)
          .eq('assigned_to', lo.id)
          .eq('source', 'referral')
          .gte('created_at', mtdStart);

        const leads = pipelineLeads ?? [];
        const closedLeads = closedMTD ?? [];

        const volumeClosedMTD = closedLeads.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

        // TRID compliance rate
        const leadsWithTrid = leads.filter((l) => l.trid_status !== 'pending');
        const compliantLeads = leadsWithTrid.filter((l) => l.trid_status === 'compliant');
        const tridRate =
          leadsWithTrid.length > 0
            ? Math.round((compliantLeads.length / leadsWithTrid.length) * 100 * 100) / 100
            : null;

        // Avg AI score
        const scoredLeads = leads.filter((l) => l.ai_score != null);
        const avgScore =
          scoredLeads.length > 0
            ? Math.round((scoredLeads.reduce((s, l) => s + (l.ai_score ?? 0), 0) / scoredLeads.length) * 10) / 10
            : null;

        // Conversion rate: closed / (closed + active)
        const totalLeads = leads.length + closedLeads.length;
        const conversionRate =
          totalLeads > 0 ? Math.round((closedLeads.length / totalLeads) * 100 * 100) / 100 : null;

        await supabase.from('lo_performance_snapshots').upsert(
          {
            org_id: org.id,
            lo_id: lo.id,
            snapshot_date: snapshotDate,
            leads_in_pipeline: leads.length,
            leads_closed_mtd: closedLeads.length,
            volume_closed_mtd: volumeClosedMTD,
            trid_compliance_rate: tridRate,
            conversion_rate: conversionRate,
            referrals_received_mtd: (referralsMTD ?? []).length,
            ai_score_avg: avgScore,
          },
          { onConflict: 'org_id,lo_id,snapshot_date' },
        );

        totalSnapshots++;
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'compliance_scan',
      status: 'completed',
      leads_processed: totalSnapshots,
      actions_taken: totalSnapshots,
      summary: `Created performance snapshots for ${totalSnapshots} LOs`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, snapshots: totalSnapshots }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
