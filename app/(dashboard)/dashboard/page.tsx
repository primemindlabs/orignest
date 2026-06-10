import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isThisMonth, subDays, formatDistanceToNow } from 'date-fns';

import { resolveDashboardPersona } from '@/lib/dashboard/persona';
import {
  ACTIVE_STAGES,
  TERMINAL_STAGES,
  derivePipelineByStage,
  deriveAlertedLeads,
  deriveWeeklyVolume,
  deriveMetrics,
  deriveOperationsStats,
  type DashLead,
} from '@/lib/dashboard/queries';

import { GreetingBar } from '@/components/dashboard/GreetingBar';
import { MoneyBar } from '@/components/shared/MoneyBar';
import { OperationsStatBar } from '@/components/dashboard/OperationsStatBar';
import { PipelineDonut } from '@/components/dashboard/PipelineDonut';
import { GoalRing } from '@/components/dashboard/GoalRing';
import { VolumeSparkline } from '@/components/dashboard/VolumeSparkline';
import { NeedsAttentionCard } from '@/components/dashboard/NeedsAttentionCard';
import { TasksCard } from '@/components/dashboard/TasksCard';
import { InboxPreviewCard } from '@/components/dashboard/InboxPreviewCard';
import { GettingStartedCard } from '@/components/dashboard/GettingStartedCard';
import { MorningBriefingCard } from '@/components/dashboard/MorningBriefingCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ensureApplicationSlug } from '@/lib/auth/slug';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Command Center' };

const TASK_ACTIVE = ['open', 'in_progress', 'waiting_on_borrower'];

export default async function DashboardPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { persona, scope } = resolveDashboardPersona(role);
  const isPersonal = scope === 'personal';
  const isFinancial = persona === 'producer' || persona === 'leadership';

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const cutoff90 = subDays(now, 90);
  const cutoff120 = subDays(now, 120).toISOString();

  // ── Profile (id needed for personal scope; comp_rate + goal for the money bar) ──
  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name, nmls_id, application_slug, comp_rate, monthly_volume_goal')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const profileId = (profile?.id as string | undefined) ?? null;
  const compRate = Number(profile?.comp_rate ?? 0.5);
  const personalOk = isPersonal && !!profileId;

  // LO shareable application link, surfaced in the dashboard quick actions.
  const applySlug =
    isFinancial && profile
      ? await ensureApplicationSlug(sb, {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          nmls_id: profile.nmls_id,
          application_slug: profile.application_slug,
        })
      : null;
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ashleyiq.com').replace(/\/$/, '');
  const applyUrl = applySlug ? `${appBase}/apply/${applySlug}` : null;

  // ── Active + recent-terminal leads (org-scoped, optionally narrowed to my book) ──
  let activeQ = sb
    .from('leads')
    .select('id, first_name, last_name, stage, loan_amount, closing_date, last_contacted_at, stage_changed_at, created_at')
    .eq('org_id', orgId)
    .in('stage', ACTIVE_STAGES);
  if (personalOk) activeQ = activeQ.eq('assigned_to', profileId);

  let termQ = sb
    .from('leads')
    .select('id, first_name, last_name, stage, loan_amount, closing_date, last_contacted_at, stage_changed_at, created_at')
    .eq('org_id', orgId)
    .in('stage', TERMINAL_STAGES)
    .or(`closing_date.gte.${cutoff120},stage_changed_at.gte.${cutoff120}`)
    .order('closing_date', { ascending: false })
    .limit(300);
  if (personalOk) termQ = termQ.eq('assigned_to', profileId);

  const [{ data: activeRows }, { data: termRows }] = await Promise.all([activeQ, termQ]);
  const activeLeads = (activeRows ?? []) as DashLead[];
  const terminalLeads = (termRows ?? []) as DashLead[];

  const activeIds = activeLeads.map((l) => l.id);
  const myLeadIds = [...activeIds, ...terminalLeads.map((l) => l.id)];

  // ── Conditions (on my active files), tasks, unread inbox, leadership goal sum ──
  const condQ = activeIds.length
    ? sb.from('loan_conditions').select('lead_id, status').in('lead_id', activeIds).neq('status', 'cleared')
    : Promise.resolve({ data: [] as { lead_id: string; status: string }[] });

  let taskQ = sb
    .from('loan_tasks')
    .select('id, title, priority, due_date, status, lead_id')
    .eq('org_id', orgId)
    .in('status', TASK_ACTIVE)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(12);
  if (personalOk) taskQ = taskQ.eq('assigned_to', profileId);

  let inboxQ = sb
    .from('inbound_messages')
    .select('id, lead_id, channel, from_address, body, created_at, read_at')
    .eq('org_id', orgId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(2);
  if (personalOk && myLeadIds.length) inboxQ = inboxQ.in('lead_id', myLeadIds);
  else if (personalOk) inboxQ = inboxQ.eq('lead_id', '00000000-0000-0000-0000-000000000000'); // my book is empty → no messages

  const goalSumQ =
    persona === 'leadership'
      ? sb.from('profiles').select('monthly_volume_goal').eq('org_id', orgId)
      : Promise.resolve({ data: null as { monthly_volume_goal: number | null }[] | null });

  const [{ data: condRows }, { data: taskRows }, { data: inboxRows }, { data: goalRows }] = await Promise.all([
    condQ,
    taskQ,
    inboxQ,
    goalSumQ,
  ]);

  const condByLead: Record<string, number> = {};
  for (const c of condRows ?? []) condByLead[c.lead_id] = (condByLead[c.lead_id] ?? 0) + 1;

  // ── Derive ──────────────────────────────────────────────────────────────────
  const closedThisMonth = terminalLeads.filter((l) => l.stage === 'closed' && l.closing_date && isThisMonth(new Date(l.closing_date)));
  const closedLeads = terminalLeads.filter((l) => l.stage === 'closed');
  const terminal90 = terminalLeads.filter((l) => {
    const d = l.closing_date ?? l.stage_changed_at ?? l.created_at;
    return d ? new Date(d) >= cutoff90 : false;
  });

  const pipelineByStage = derivePipelineByStage(activeLeads);
  const weeklyVolume = deriveWeeklyVolume(closedLeads, now, 8);
  const alertedLeads = deriveAlertedLeads(activeLeads, condByLead, now, 3);
  const metrics = deriveMetrics({ activeLeads, closedThisMonth, terminal90, conditionCountByLead: condByLead, compRate, now });

  const activeTasks = (taskRows ?? []) as { id: string; title: string; priority: string; due_date: string | null; lead_id: string | null }[];
  const dueTodayTasks = activeTasks.filter((t) => t.due_date && t.due_date <= todayStr);
  const tasksDueToday = dueTodayTasks.length;

  // Goal: producer = own; leadership = team rollup (falls back to own / 4M).
  const ownGoal = Number(profile?.monthly_volume_goal ?? 4_000_000);
  const teamGoal = (goalRows ?? []).reduce((s, g) => s + Number(g.monthly_volume_goal ?? 0), 0);
  const goal = persona === 'leadership' ? teamGoal || ownGoal : ownGoal;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();

  const firstName = (profile?.first_name as string | undefined) ?? 'there';

  const taskCards = activeTasks.slice(0, 4).map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    leadId: t.lead_id,
    dueLabel: !t.due_date ? null : t.due_date < todayStr ? 'Overdue' : t.due_date === todayStr ? 'Today' : new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const inboxCards = ((inboxRows ?? []) as { id: string; channel: string | null; from_address: string | null; body: string | null; created_at: string }[]).map((m) => ({
    id: m.id,
    from: m.from_address || 'Unknown sender',
    channel: m.channel ?? 'sms',
    snippet: (m.body ?? '').slice(0, 80),
    timeLabel: formatDistanceToNow(new Date(m.created_at), { addSuffix: false }),
  }));

  const opsStats = deriveOperationsStats({ activeLeads, conditionCountByLead: condByLead, tasksDueToday, now });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '0 -1.5rem -1.5rem', minHeight: 0 }}>
      <GreetingBar name={firstName} alertCount={metrics.alertCount} tasksDueToday={tasksDueToday} />

      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <GettingStartedCard orgId={orgId} clerkUserId={userId} />
        {isFinancial && <QuickActions applyUrl={applyUrl} />}
        {isFinancial && <MorningBriefingCard />}

        {isFinancial ? (
          <MoneyBar
            mtdVolume={metrics.mtdVolume}
            mtdLoanCount={metrics.mtdLoanCount}
            closingVolume={metrics.closingVolume}
            closingCount={metrics.closingCount}
            estimatedCommission={metrics.estimatedCommission}
            compRate={metrics.compRate}
            pullThrough={metrics.pullThrough}
            pullThroughDelta={metrics.pullThroughDelta}
            alertCount={metrics.alertCount}
          />
        ) : (
          <OperationsStatBar
            filesInQueue={opsStats.filesInQueue}
            conditionsOutstanding={opsStats.conditionsOutstanding}
            tasksDueToday={opsStats.tasksDueToday}
            closingThisMonth={opsStats.closingThisMonth}
          />
        )}

        {isFinancial ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <PipelineDonut stages={pipelineByStage} />
            <GoalRing
              current={metrics.mtdVolume}
              goal={goal}
              daysLeft={daysLeft}
              label={persona === 'leadership' ? 'Team goal' : 'Monthly goal'}
            />
            <VolumeSparkline weeks={weeklyVolume} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <PipelineDonut stages={pipelineByStage} />
            <NeedsAttentionCard leads={alertedLeads} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {isFinancial ? (
            <NeedsAttentionCard leads={alertedLeads} />
          ) : (
            <TasksCard tasks={taskCards} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {isFinancial && <TasksCard tasks={taskCards} />}
            <InboxPreviewCard messages={inboxCards} />
          </div>
        </div>
      </div>
    </div>
  );
}
