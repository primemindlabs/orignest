import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = createAdminClient();

    // Get org UUID
    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .single();

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // Get caller profile
    const { data: profile } = await sb
      .from('profiles')
      .select('id,role,first_name,last_name')
      .eq('clerk_user_id', userId)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // If manager/admin: get briefings for all LOs; otherwise just self
    const isManager = ['admin', 'branch_manager'].includes(profile.role);
    const loIds: string[] = [];

    if (isManager) {
      const { data: los } = await sb
        .from('profiles')
        .select('id')
        .eq('org_id', org.id)
        .eq('is_active', true);
      loIds.push(...(los ?? []).map((l) => l.id));
    } else {
      loIds.push(profile.id);
    }

    const briefings: Record<string, unknown>[] = [];
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    for (const loId of loIds) {
      // Check for today's cached briefing
      const { data: cached } = await sb
        .from('morning_briefings')
        .select('*')
        .eq('org_id', org.id)
        .eq('lo_id', loId)
        .eq('briefing_date', today)
        .maybeSingle();

      if (cached) {
        // Mark as read
        if (!cached.read_at) {
          await sb
            .from('morning_briefings')
            .update({ read_at: new Date().toISOString() })
            .eq('id', cached.id);
        }
        briefings.push(cached as Record<string, unknown>);
        continue;
      }

      // Generate fresh briefing
      const [leadsResult, tasksResult] = await Promise.all([
        sb
          .from('leads')
          .select(
            'id,first_name,last_name,stage,loan_amount,ai_score,last_contact_at,trid_status,application_date,le_sent_date,cd_sent_date,closing_date,days_in_stage',
          )
          .eq('org_id', org.id)
          .eq('assigned_to', loId)
          .not('stage', 'in', '("closed","dead")'),
        sb
          .from('lead_tasks')
          .select('id,title,lead_id,priority,due_date')
          .eq('org_id', org.id)
          .eq('assigned_to', loId)
          .is('completed_at', null)
          .lte('due_date', new Date(now + 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const leads = leadsResult.data ?? [];
      const tasks = tasksResult.data ?? [];

      const noContactLeads = leads.filter((l) => {
        if (!l.last_contact_at) return true;
        return now - new Date(l.last_contact_at).getTime() > 24 * 60 * 60 * 1000;
      });

      const tridAlerts = leads.filter((l) => {
        if (l.trid_status === 'compliant') return false;
        if (l.application_date && !l.le_sent_date) {
          const deadline = new Date(l.application_date).getTime() + 3 * 24 * 60 * 60 * 1000;
          return deadline - now < 3 * 24 * 60 * 60 * 1000;
        }
        return false;
      });

      const stalledLeads = leads.filter((l) => (l.days_in_stage ?? 0) >= 7);

      const pipelineStats = {
        total: leads.length,
        totalVolume: leads.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
        noContact: noContactLeads.length,
      };

      const priorityLeads = [...leads]
        .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
        .slice(0, 5)
        .map((l) => ({
          id: l.id,
          name: `${l.first_name} ${l.last_name}`,
          stage: l.stage,
          aiScore: l.ai_score,
          loanAmount: l.loan_amount,
        }));

      // Generate AI summary
      const contextLines = [
        `Pipeline: ${leads.length} active leads, $${((pipelineStats.totalVolume) / 1_000_000).toFixed(1)}M volume`,
        `No contact in 24h: ${noContactLeads.length}`,
        `TRID alerts: ${tridAlerts.length}`,
        `Stalled leads (7+ days): ${stalledLeads.length}`,
        `Tasks due today: ${tasks.length}`,
        `Top leads: ${priorityLeads.slice(0, 3).map((l) => `${l.name} (${l.stage})`).join(', ')}`,
      ];

      const aiMessage = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system:
          'You are an AI chief of staff for a mortgage loan officer. Generate a concise morning briefing with: (1) The 3 most urgent actions, (2) TRID alerts if any, (3) Stalled leads, (4) Today\'s priorities. Be specific, actionable, brief. Use plain text.',
        messages: [{ role: 'user', content: contextLines.join('\n') }],
      });

      const summaryBlock = aiMessage.content[0];
      const summary = summaryBlock.type === 'text' ? summaryBlock.text : 'Unable to generate briefing.';

      // Save briefing
      const { data: newBriefing } = await sb
        .from('morning_briefings')
        .upsert(
          {
            org_id: org.id,
            lo_id: loId,
            briefing_date: today,
            summary,
            priority_leads: priorityLeads,
            trid_alerts: tridAlerts.map((l) => ({
              leadId: l.id,
              name: `${l.first_name} ${l.last_name}`,
              tridStatus: l.trid_status,
            })),
            rate_watch_alerts: [],
            tasks_due: tasks,
            pipeline_stats: pipelineStats,
            delivered_at: new Date().toISOString(),
            read_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,lo_id,briefing_date' },
        )
        .select()
        .single();

      briefings.push(newBriefing as Record<string, unknown>);
    }

    return NextResponse.json({ briefings });
  } catch (err) {
    console.error('[ai/morning-briefing]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 },
    );
  }
}
