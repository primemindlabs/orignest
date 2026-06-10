import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';
import { Resend } from 'https://esm.sh/resend@3.2.0';

// ── Runs every Monday at 7:30am UTC (pg_cron schedule) ──────────────────────
// For each active LO in each active org:
//   1. Query last week's metrics
//   2. Generate a 2-sentence AI insight via Claude Haiku
//   3. Send HTML email via Resend

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://ashleyiq.com';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@ashleyiq.com';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  org_id: string;
}

interface WeekMetrics {
  pipelineValue: number;
  closedCount: number;
  closedLastWeekCount: number;
  newLeadsCount: number;
  avgSpeedMinutes: number | null;
  avgSpeedLastWeekMinutes: number | null;
  tridCompliantCount: number;
  tridTotalCount: number;
  tasksCompletedCount: number;
  upcomingTridDeadlines: Array<{ name: string; day: string; type: string }>;
  expiringRateLocks: Array<{ name: string; day: string }>;
  overdueTasks: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatMinutes(mins: number | null): string {
  if (mins === null) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

function weekRange(offset = 0): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  };
}

// ─── Fetch metrics for one LO ─────────────────────────────────────────────

async function fetchMetrics(
  profileId: string,
  orgId: string,
): Promise<WeekMetrics> {
  const thisWeek = weekRange(-1); // last completed week
  const prevWeek = weekRange(-2); // week before

  const ACTIVE_STAGES = [
    'new_inquiry', 'pre_qual', 'application', 'processing',
    'underwriting', 'conditional_approval', 'clear_to_close',
  ];

  const [
    { data: pipelineLeads },
    { data: closedThisWeek },
    { data: closedLastWeek },
    { data: newLeads },
    { data: contactedLeads },
    { data: prevContactedLeads },
    { data: tridLeads },
    { data: overdueTasks },
  ] = await Promise.all([
    // Pipeline
    supabase.from('leads')
      .select('loan_amount')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .in('stage', ACTIVE_STAGES),
    // Closed this week
    supabase.from('leads')
      .select('id')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .eq('stage', 'closed')
      .gte('updated_at', thisWeek.start)
      .lte('updated_at', thisWeek.end),
    // Closed last week
    supabase.from('leads')
      .select('id')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .eq('stage', 'closed')
      .gte('updated_at', prevWeek.start)
      .lte('updated_at', prevWeek.end),
    // New leads
    supabase.from('leads')
      .select('id')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .gte('created_at', thisWeek.start)
      .lte('created_at', thisWeek.end),
    // Speed to contact this week
    supabase.from('leads')
      .select('created_at, first_contacted_at')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .not('first_contacted_at', 'is', null)
      .gte('created_at', thisWeek.start)
      .lte('created_at', thisWeek.end),
    // Speed to contact last week
    supabase.from('leads')
      .select('created_at, first_contacted_at')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .not('first_contacted_at', 'is', null)
      .gte('created_at', prevWeek.start)
      .lte('created_at', prevWeek.end),
    // TRID compliance
    supabase.from('leads')
      .select('id, first_name, last_name, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .not('application_submitted_at', 'is', null)
      .in('stage', ACTIVE_STAGES),
    // Overdue tasks
    supabase.from('lead_tasks')
      .select('id')
      .eq('assigned_to', profileId)
      .eq('org_id', orgId)
      .eq('completed', false)
      .lt('due_date', new Date().toISOString()),
  ]);

  // Pipeline value
  const pipelineValue = (pipelineLeads ?? []).reduce(
    (sum, l) => sum + (l.loan_amount ?? 0), 0
  );

  // Speed calculations
  const calcAvgSpeed = (leads: Array<{ created_at: string; first_contacted_at: string | null }>) => {
    const valid = leads.filter((l) => l.first_contacted_at);
    if (valid.length === 0) return null;
    const sum = valid.reduce((s, l) => {
      const diff = new Date(l.first_contacted_at!).getTime() - new Date(l.created_at).getTime();
      return s + diff / 60_000; // ms → minutes
    }, 0);
    return sum / valid.length;
  };

  // TRID upcoming deadlines (next 7 days)
  const upcomingTridDeadlines: WeekMetrics['upcomingTridDeadlines'] = [];
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const lead of tridLeads ?? []) {
    if (!lead.application_submitted_at) continue;
    const appDate = new Date(lead.application_submitted_at);
    const leDeadline = new Date(appDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const name = `${lead.first_name} ${lead.last_name}`;

    if (!lead.loan_estimate_sent_at && leDeadline > now && leDeadline < sevenDays) {
      upcomingTridDeadlines.push({
        name,
        day: leDeadline.toLocaleDateString('en-US', { weekday: 'long' }),
        type: 'LE Due',
      });
    }

    if (lead.closing_date) {
      const closingDate = new Date(lead.closing_date);
      const cdDeadline = new Date(closingDate.getTime() - 3 * 24 * 60 * 60 * 1000);
      if (!lead.closing_disclosure_sent_at && cdDeadline > now && cdDeadline < sevenDays) {
        upcomingTridDeadlines.push({
          name,
          day: cdDeadline.toLocaleDateString('en-US', { weekday: 'long' }),
          type: 'CD Due',
        });
      }
    }
  }

  // TRID compliance rate
  const tridCompliant = (tridLeads ?? []).filter((l) => l.loan_estimate_sent_at).length;

  return {
    pipelineValue,
    closedCount: (closedThisWeek ?? []).length,
    closedLastWeekCount: (closedLastWeek ?? []).length,
    newLeadsCount: (newLeads ?? []).length,
    avgSpeedMinutes: calcAvgSpeed(contactedLeads ?? []),
    avgSpeedLastWeekMinutes: calcAvgSpeed(prevContactedLeads ?? []),
    tridCompliantCount: tridCompliant,
    tridTotalCount: (tridLeads ?? []).length,
    tasksCompletedCount: 0, // would need a separate query
    upcomingTridDeadlines,
    expiringRateLocks: [], // TODO: from rate_lock_expires field
    overdueTasks: (overdueTasks ?? []).length,
  };
}

// ─── Generate AI insight ──────────────────────────────────────────────────

async function generateInsight(
  firstName: string,
  metrics: WeekMetrics,
): Promise<string> {
  const speedChange = metrics.avgSpeedMinutes !== null && metrics.avgSpeedLastWeekMinutes !== null
    ? metrics.avgSpeedLastWeekMinutes - metrics.avgSpeedMinutes
    : null;

  const prompt = `You are a sales coach for a mortgage loan officer named ${firstName}. Write exactly 2 sentences of personalized encouragement and insight based on last week's performance. Be specific, warm, and actionable. No markdown, no emojis.

Metrics:
- Pipeline: ${formatCurrency(metrics.pipelineValue)}
- Loans closed last week: ${metrics.closedCount} (vs ${metrics.closedLastWeekCount} prior week)
- New leads: ${metrics.newLeadsCount}
- Avg speed-to-contact: ${formatMinutes(metrics.avgSpeedMinutes)}${speedChange !== null ? ` (${speedChange > 0 ? '+' : ''}${Math.round(speedChange)}min vs last week)` : ''}
- TRID compliance: ${metrics.tridTotalCount > 0 ? `${Math.round((metrics.tridCompliantCount / metrics.tridTotalCount) * 100)}%` : 'N/A'}
- Overdue tasks: ${metrics.overdueTasks}

Write 2 sentences only.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : `You had a solid week, ${firstName}. Keep the momentum going!`;
  } catch {
    return `Great work last week, ${firstName}. Your pipeline is looking strong — keep pushing!`;
  }
}

// ─── Build HTML email ─────────────────────────────────────────────────────

function buildEmailHTML(
  firstName: string,
  metrics: WeekMetrics,
  insight: string,
  weekLabel: string,
): string {
  const tridRate = metrics.tridTotalCount > 0
    ? `${Math.round((metrics.tridCompliantCount / metrics.tridTotalCount) * 100)}%`
    : 'N/A';

  const upcomingItems = [
    ...metrics.upcomingTridDeadlines.map(
      (d) => `<li style="margin-bottom:6px;color:#3C3C43;">${d.type} for ${d.name} — ${d.day}</li>`
    ),
    ...metrics.expiringRateLocks.map(
      (r) => `<li style="margin-bottom:6px;color:#FF9500;">${r.name}'s rate lock expires ${r.day}</li>`
    ),
    metrics.overdueTasks > 0
      ? `<li style="margin-bottom:6px;color:#FF3B30;">${metrics.overdueTasks} overdue task${metrics.overdueTasks !== 1 ? 's' : ''}</li>`
      : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Snapshot</title>
</head>
<body style="margin:0;padding:0;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#0F1D2E;border-radius:12px 12px 0 0;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <div style="width:28px;height:28px;background:#C9A95C;border-radius:7px;display:inline-block;vertical-align:middle;"></div>
                      <span style="color:#C9A95C;font-size:16px;font-weight:700;vertical-align:middle;margin-left:8px;">AshleyIQ</span>
                    </div>
                    <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:6px 0 0;">Your Weekly Snapshot · ${weekLabel}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="background:#FFFFFF;padding:28px 32px 0;">
              <h1 style="font-size:22px;font-weight:700;color:#000000;margin:0 0 6px;">Your week in mortgage, ${firstName} 📊</h1>
              <p style="font-size:14px;color:#6C6C70;margin:0;">Here's how last week went — and what needs your attention this week.</p>
            </td>
          </tr>

          <!-- Metrics row -->
          <tr>
            <td style="background:#FFFFFF;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 8px 0 0;">
                    <div style="background:#F2F2F7;border-radius:10px;padding:16px 12px;text-align:center;">
                      <div style="font-size:24px;font-weight:800;color:#000000;font-variant-numeric:tabular-nums;">${formatCurrency(metrics.pipelineValue)}</div>
                      <div style="font-size:11px;color:#6C6C70;margin-top:4px;font-weight:500;">Pipeline</div>
                    </div>
                  </td>
                  <td align="center" style="padding:0 8px;">
                    <div style="background:#F2F2F7;border-radius:10px;padding:16px 12px;text-align:center;">
                      <div style="font-size:24px;font-weight:800;color:#000000;font-variant-numeric:tabular-nums;">${metrics.closedCount}</div>
                      <div style="font-size:11px;color:#6C6C70;margin-top:4px;font-weight:500;">Closed</div>
                    </div>
                  </td>
                  <td align="center" style="padding:0 8px;">
                    <div style="background:#F2F2F7;border-radius:10px;padding:16px 12px;text-align:center;">
                      <div style="font-size:24px;font-weight:800;color:#000000;font-variant-numeric:tabular-nums;">${formatMinutes(metrics.avgSpeedMinutes)}</div>
                      <div style="font-size:11px;color:#6C6C70;margin-top:4px;font-weight:500;">Avg Speed</div>
                    </div>
                  </td>
                  <td align="center" style="padding:0 0 0 8px;">
                    <div style="background:#F2F2F7;border-radius:10px;padding:16px 12px;text-align:center;">
                      <div style="font-size:24px;font-weight:800;color:#000000;font-variant-numeric:tabular-nums;">${tridRate}</div>
                      <div style="font-size:11px;color:#6C6C70;margin-top:4px;font-weight:500;">TRID Rate</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AI Insight -->
          <tr>
            <td style="background:#FFFFFF;padding:0 32px 24px;">
              <div style="background:linear-gradient(135deg,#0F1D2E,#1a2e45);border-radius:10px;padding:18px 20px;">
                <p style="font-size:11px;font-weight:700;color:#C9A95C;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">AI Insight</p>
                <p style="font-size:14px;color:rgba(255,255,255,0.88);line-height:1.65;margin:0;">${insight}</p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#FFFFFF;padding:0 32px 24px;">
              <a href="${APP_URL}/dashboard" style="display:inline-block;background:#007AFF;color:#FFFFFF;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
                View Your Pipeline →
              </a>
            </td>
          </tr>

          ${upcomingItems ? `
          <!-- Upcoming this week -->
          <tr>
            <td style="background:#FFFFFF;padding:0 32px 24px;">
              <div style="border-top:1px solid rgba(60,60,67,0.10);padding-top:20px;">
                <p style="font-size:13px;font-weight:700;color:#000000;margin:0 0 12px;">Upcoming this week</p>
                <ul style="margin:0;padding:0 0 0 16px;font-size:13px;line-height:1.6;">${upcomingItems}</ul>
              </div>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="background:#FFFFFF;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid rgba(60,60,67,0.08);">
              <p style="font-size:11px;color:#AEAEB2;margin:0;">
                AshleyIQ · <a href="${APP_URL}/settings" style="color:#AEAEB2;text-decoration:underline;">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────

Deno.serve(async () => {
  try {
    let emailsSent = 0;
    let errors = 0;

    // Get all active orgs
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('subscription_status', 'active');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, emailsSent: 0 }), { status: 200 });
    }

    const weekLabel = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    for (const org of orgs) {
      // Get all LOs in this org
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, org_id')
        .eq('org_id', org.id)
        .in('role', ['loan_officer', 'branch_manager', 'admin'])
        .not('email', 'is', null);

      for (const profile of profiles ?? []) {
        if (!profile.email) continue;

        try {
          const metrics = await fetchMetrics(profile.id, org.id);
          const insight = await generateInsight(profile.first_name ?? 'there', metrics);
          const html = buildEmailHTML(
            profile.first_name ?? 'there',
            metrics,
            insight,
            weekLabel,
          );

          await resend.emails.send({
            from: `AshleyIQ <${FROM_EMAIL}>`,
            to: profile.email,
            subject: `Your week in mortgage, ${profile.first_name ?? 'there'} 📊`,
            html,
          });

          emailsSent++;
        } catch (profileErr) {
          console.error(`[weekly-email] Failed for profile ${profile.id}:`, profileErr);
          errors++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, emailsSent, errors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[weekly-email] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
