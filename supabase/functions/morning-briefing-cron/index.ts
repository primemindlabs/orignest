import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

interface LOBriefingData {
  loId: string;
  loEmail: string;
  loName: string;
  orgId: string;
  priorityLeads: unknown[];
  tridAlerts: unknown[];
  tasksdue: unknown[];
  stalledLeads: unknown[];
  pipelineStats: Record<string, unknown>;
}

async function buildBriefingForLO(orgId: string, loId: string): Promise<LOBriefingData | null> {
  const [loResult, leadsResult, tasksResult] = await Promise.all([
    supabase.from('profiles').select('id,email,first_name,last_name').eq('id', loId).single(),
    supabase
      .from('leads')
      .select('id,first_name,last_name,stage,loan_amount,ai_score,last_contact_at,trid_status,le_sent_date,cd_sent_date,application_date,closing_date,days_in_stage,updated_at')
      .eq('org_id', orgId)
      .eq('assigned_to', loId)
      .not('stage', 'in', '("closed","dead")')
      .order('ai_score', { ascending: false }),
    supabase
      .from('lead_tasks')
      .select('id,title,lead_id,priority,due_date')
      .eq('org_id', orgId)
      .eq('assigned_to', loId)
      .is('completed_at', null)
      .lte('due_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (loResult.error || !loResult.data) return null;
  const lo = loResult.data;
  const leads = leadsResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  const now = Date.now();

  // Leads with no contact in 24+ hours
  const noContactLeads = leads.filter((l) => {
    if (!l.last_contact_at) return true;
    return now - new Date(l.last_contact_at).getTime() > 24 * 60 * 60 * 1000;
  });

  // TRID deadlines in next 3 days
  const tridAlerts = leads.filter((l) => {
    if (l.trid_status === 'compliant') return false;
    if (l.application_date) {
      const appDate = new Date(l.application_date).getTime();
      const leDeadline = appDate + 3 * 24 * 60 * 60 * 1000;
      if (!l.le_sent_date && leDeadline - now < 3 * 24 * 60 * 60 * 1000) return true;
    }
    if (l.le_sent_date && !l.cd_sent_date && l.closing_date) {
      const closeDate = new Date(l.closing_date).getTime();
      if (closeDate - now < 4 * 24 * 60 * 60 * 1000) return true;
    }
    return false;
  });

  // Stalled leads (7+ days in stage, no recent activity)
  const stalledLeads = leads.filter((l) => (l.days_in_stage ?? 0) >= 7);

  // Pipeline stats
  const pipelineStats = {
    total: leads.length,
    totalVolume: leads.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
    byStage: leads.reduce(
      (acc, l) => {
        acc[l.stage] = (acc[l.stage] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  // Priority leads = top 5 by ai_score with urgency
  const priorityLeads = [...leads]
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      stage: l.stage,
      aiScore: l.ai_score,
      loanAmount: l.loan_amount,
      daysSinceContact: l.last_contact_at
        ? Math.floor((now - new Date(l.last_contact_at).getTime()) / (24 * 60 * 60 * 1000))
        : null,
    }));

  return {
    loId,
    loEmail: lo.email,
    loName: `${lo.first_name} ${lo.last_name}`,
    orgId,
    priorityLeads,
    tridAlerts: tridAlerts.map((l) => ({
      leadId: l.id,
      name: `${l.first_name} ${l.last_name}`,
      tridStatus: l.trid_status,
      applicationDate: l.application_date,
      closingDate: l.closing_date,
    })),
    tasksdue: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      leadId: t.lead_id,
      priority: t.priority,
      dueDate: t.due_date,
    })),
    stalledLeads: stalledLeads.map((l) => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      stage: l.stage,
      daysInStage: l.days_in_stage,
    })),
    pipelineStats,
  };
}

async function generateBriefingSummary(data: LOBriefingData): Promise<string> {
  const contextLines = [
    `LO: ${data.loName}`,
    `Pipeline: ${data.pipelineStats.total} active leads, $${((data.pipelineStats.totalVolume as number) / 1_000_000).toFixed(1)}M volume`,
    `TRID alerts: ${data.tridAlerts.length}`,
    `Stalled leads (7+ days): ${data.stalledLeads.length}`,
    `Tasks due today: ${data.tasksdue.length}`,
    `Priority leads: ${JSON.stringify(data.priorityLeads.slice(0, 3))}`,
  ];

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    system:
      'You are an AI chief of staff for a mortgage loan officer. Generate a concise morning briefing with: (1) The 3 most urgent actions, (2) TRID alerts if any, (3) Stalled leads needing attention, (4) Today\'s priorities. Be specific, actionable, and brief. Use plain text, no markdown.',
    messages: [{ role: 'user', content: contextLines.join('\n') }],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : 'Unable to generate briefing.';
}

Deno.serve(async () => {
  const runId = crypto.randomUUID();

  try {
    // Get all active orgs
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
    }

    let totalProcessed = 0;

    for (const org of orgs) {
      // Check org config
      const { data: config } = await supabase
        .from('org_ai_config')
        .select('morning_briefing_enabled')
        .eq('org_id', org.id)
        .maybeSingle();

      if (config && !config.morning_briefing_enabled) continue;

      // Get all active LOs in org
      const { data: los } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', org.id)
        .eq('is_active', true)
        .in('role', ['loan_officer', 'branch_manager', 'admin']);

      if (!los?.length) continue;

      for (const lo of los) {
        const data = await buildBriefingForLO(org.id, lo.id);
        if (!data) continue;

        const summary = await generateBriefingSummary(data);
        const today = new Date().toISOString().split('T')[0];

        await supabase.from('morning_briefings').upsert(
          {
            org_id: org.id,
            lo_id: lo.id,
            briefing_date: today,
            summary,
            priority_leads: data.priorityLeads,
            trid_alerts: data.tridAlerts,
            rate_watch_alerts: [],
            tasks_due: data.tasksdue,
            pipeline_stats: data.pipelineStats,
            delivered_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,lo_id,briefing_date' },
        );

        totalProcessed++;
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'morning_briefing',
      status: 'completed',
      leads_processed: totalProcessed,
      actions_taken: totalProcessed,
      summary: `Delivered briefings to ${totalProcessed} LOs`,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, processed: totalProcessed }), { status: 200 });
  } catch (err) {
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'morning_briefing',
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
