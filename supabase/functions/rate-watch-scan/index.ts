import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Fetch current 30-year fixed rate from FRED (or use a mock for dev)
async function fetchCurrentRate(): Promise<number> {
  try {
    const fredApiKey = Deno.env.get('FRED_API_KEY');
    if (!fredApiKey) {
      // Mock rate for development
      return 6.875;
    }

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${fredApiKey}&sort_order=desc&limit=1&file_type=json`;
    const res = await fetch(url);
    if (!res.ok) return 6.875;
    const data = await res.json() as { observations: Array<{ value: string }> };
    const latest = data.observations?.[0]?.value;
    return latest ? parseFloat(latest) : 6.875;
  } catch {
    return 6.875;
  }
}

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths = 360): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

Deno.serve(async () => {
  try {
    const currentRate = await fetchCurrentRate();

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, opportunities: 0 }), { status: 200 });
    }

    let totalOpportunities = 0;

    for (const org of orgs) {
      const { data: config } = await supabase
        .from('org_ai_config')
        .select('rate_watch_enabled')
        .eq('org_id', org.id)
        .maybeSingle();

      if (config && !config.rate_watch_enabled) continue;

      // Get closed leads with locked rates
      const { data: closedLeads } = await supabase
        .from('leads')
        .select('id,first_name,last_name,locked_rate,loan_amount,assigned_to')
        .eq('org_id', org.id)
        .eq('stage', 'closed')
        .eq('rate_locked', true)
        .not('locked_rate', 'is', null)
        .not('loan_amount', 'is', null);

      for (const lead of closedLeads ?? []) {
        const originalRate = lead.locked_rate as number;
        const loanAmount = lead.loan_amount as number;

        // Refi opportunity: current rate is 0.75+ points lower than original
        if (currentRate <= originalRate - 0.75) {
          const originalPayment = calculateMonthlyPayment(loanAmount, originalRate);
          const newPayment = calculateMonthlyPayment(loanAmount, currentRate);
          const monthlySavings = originalPayment - newPayment;

          if (monthlySavings >= 100) {
            // Check if we already have an active watch for this lead
            const { data: existing } = await supabase
              .from('rate_watch')
              .select('id,alert_sent')
              .eq('lead_id', lead.id)
              .eq('watch_type', 'refi_opportunity')
              .eq('active', true)
              .maybeSingle();

            if (!existing) {
              await supabase.from('rate_watch').insert({
                org_id: org.id,
                lead_id: lead.id,
                watch_type: 'refi_opportunity',
                trigger_rate_threshold: originalRate - 0.75,
                current_rate: currentRate,
                original_rate: originalRate,
                original_loan_amount: loanAmount,
                monthly_savings: monthlySavings,
                alert_sent: false,
              });

              // Log activity on lead
              await supabase.from('lead_activities').insert({
                lead_id: lead.id,
                org_id: org.id,
                action: 'rate_watch_alert',
                description: `Refi opportunity detected: current rate ${currentRate}% vs original ${originalRate}%. Est. monthly savings: $${monthlySavings.toFixed(0)}`,
                metadata: {
                  agent: 'rate_watch',
                  currentRate,
                  originalRate,
                  monthlySavings: Math.round(monthlySavings),
                },
              });

              totalOpportunities++;
            } else if (existing && !existing.alert_sent) {
              // Update existing with fresh numbers
              await supabase
                .from('rate_watch')
                .update({ current_rate: currentRate, monthly_savings: monthlySavings })
                .eq('id', existing.id);
            }
          }
        }
      }
    }

    await supabase.from('ai_agent_runs').insert({
      agent_type: 'rate_watch',
      status: 'completed',
      leads_processed: totalOpportunities,
      actions_taken: totalOpportunities,
      summary: `Found ${totalOpportunities} new refi opportunities at ${currentRate}% market rate`,
      completed_at: new Date().toISOString(),
      metadata: { current_market_rate: currentRate },
    });

    return new Response(JSON.stringify({ ok: true, opportunities: totalOpportunities, currentRate }), {
      status: 200,
    });
  } catch (err) {
    await supabase.from('ai_agent_runs').insert({
      agent_type: 'rate_watch',
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
