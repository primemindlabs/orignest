import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { TodayClient } from './TodayClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Today' };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayAction {
  id: string;
  type: 'trid_alert' | 'speed_to_contact' | 'followup_due' | 'task_due' | 'app_incomplete' | 'rate_watch';
  priority: number; // 1 = highest
  leadId?: string;
  leadName?: string;
  taskId?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref?: string;
  secondaryActions?: Array<{ label: string; action: string; href?: string }>;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface TomorrowItem {
  label: string;
  href: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const [
    { data: profile },
    { data: leads },
    { data: tasks },
    { data: tomorrowTasks },
  ] = await Promise.all([
    sb.from('profiles').select('first_name').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('leads').select(
      'id, first_name, last_name, stage, loan_type, loan_amount, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, le_deadline, cd_deadline, closing_date, first_contacted_at, last_contacted_at, created_at, credit_score'
    ).eq('org_id', orgId),
    sb.from('lead_tasks').select('id, lead_id, title, due_date, completed').eq('org_id', orgId).eq('completed', false).lte('due_date', todayStr).not('due_date', 'is', null).order('due_date').limit(10),
    sb.from('lead_tasks').select('id, lead_id, title, due_date, completed').eq('org_id', orgId).eq('completed', false).gt('due_date', todayStr).lte('due_date', format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd')).order('due_date').limit(3),
  ]);

  const allLeads = leads ?? [];
  const allTasks = tasks ?? [];
  const actions: TodayAction[] = [];

  // ── 1. TRID Alerts (priority 1 — highest) ──────────────────────────────────
  for (const lead of allLeads) {
    if (!lead.application_submitted_at) continue;
    const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
    if (trid.le === 'overdue' || trid.le === 'due_today') {
      const deadline = lead.le_deadline
        ? format(new Date(lead.le_deadline), 'h:mm a')
        : '3 business days';
      actions.push({
        id: `trid-le-${lead.id}`,
        type: 'trid_alert',
        priority: 1,
        leadId: lead.id,
        leadName: `${lead.first_name} ${lead.last_name}`,
        title: `Send Loan Estimate to ${lead.last_name} by ${trid.le === 'due_today' ? deadline + ' today' : 'now (OVERDUE)'}`,
        subtitle: `TRID compliance deadline${trid.le === 'overdue' ? ' — past due' : ' — due today'}`,
        ctaLabel: 'Open Lead',
        ctaHref: `/leads/${lead.id}`,
        secondaryActions: [{ label: 'Mark LE Sent', action: 'mark_le_sent' }],
        metadata: { leadId: lead.id, status: trid.le },
      });
    }
    if (trid.cd === 'overdue' || trid.cd === 'due_today') {
      actions.push({
        id: `trid-cd-${lead.id}`,
        type: 'trid_alert',
        priority: 1,
        leadId: lead.id,
        leadName: `${lead.first_name} ${lead.last_name}`,
        title: `Send Closing Disclosure to ${lead.last_name}${trid.cd === 'overdue' ? ' — OVERDUE' : ' — due today'}`,
        subtitle: 'TRID 3-day waiting period compliance',
        ctaLabel: 'Open Lead',
        ctaHref: `/leads/${lead.id}`,
        secondaryActions: [{ label: 'Mark CD Sent', action: 'mark_cd_sent' }],
        metadata: { leadId: lead.id, status: trid.cd },
      });
    }
  }

  // ── 2. Speed-to-Contact (priority 2) ───────────────────────────────────────
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  for (const lead of allLeads) {
    if (lead.stage !== 'new_inquiry') continue;
    if (lead.first_contacted_at) continue;
    if (lead.created_at < cutoff24h) continue;

    const elapsedMs = now.getTime() - new Date(lead.created_at).getTime();
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const elapsedStr =
      elapsedMin < 60 ? `${elapsedMin} min ago` : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m ago`;

    actions.push({
      id: `s2c-${lead.id}`,
      type: 'speed_to_contact',
      priority: 2,
      leadId: lead.id,
      leadName: `${lead.first_name} ${lead.last_name}`,
      title: `New lead: ${lead.first_name} ${lead.last_name} — contacted ${elapsedStr}`,
      subtitle: `New inquiry · ${lead.loan_type ?? 'Loan type TBD'}${lead.loan_amount ? ` · $${(lead.loan_amount / 1000).toFixed(0)}K` : ''}`,
      ctaLabel: 'Call Now',
      ctaHref: `/leads/${lead.id}`,
      secondaryActions: [{ label: 'Send SMS', action: 'send_sms', href: `/leads/${lead.id}?tab=sms` }],
      metadata: { elapsedMin, leadId: lead.id },
    });
  }

  // ── 3. Follow-ups due (priority 3) ─────────────────────────────────────────
  const activeStages = ['pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval'];
  const staleThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const lead of allLeads) {
    if (!activeStages.includes(lead.stage)) continue;
    const lastContact = lead.last_contacted_at ?? lead.created_at;
    if (lastContact > staleThreshold) continue;

    const daysSince = Math.floor((now.getTime() - new Date(lastContact).getTime()) / 86400000);
    actions.push({
      id: `followup-${lead.id}`,
      type: 'followup_due',
      priority: 3,
      leadId: lead.id,
      leadName: `${lead.first_name} ${lead.last_name}`,
      title: `Last contact: ${daysSince} days ago — ${lead.first_name} ${lead.last_name}`,
      subtitle: `Stage: ${lead.stage.replace(/_/g, ' ')}${lead.loan_amount ? ` · $${(lead.loan_amount / 1000).toFixed(0)}K` : ''}`,
      ctaLabel: 'Call',
      ctaHref: `/leads/${lead.id}`,
      secondaryActions: [
        { label: 'Text', action: 'text', href: `/leads/${lead.id}?tab=sms` },
        { label: 'Email', action: 'email', href: `/leads/${lead.id}?tab=email` },
        { label: 'Snooze 2d', action: 'snooze' },
      ],
      metadata: { daysSince, leadId: lead.id },
    });
  }

  // ── 4. Tasks due today (priority 4) ────────────────────────────────────────
  for (const task of allTasks) {
    const lead = allLeads.find((l) => l.id === task.lead_id);
    actions.push({
      id: `task-${task.id}`,
      type: 'task_due',
      priority: 4,
      leadId: task.lead_id,
      taskId: task.id,
      leadName: lead ? `${lead.first_name} ${lead.last_name}` : undefined,
      title: task.title,
      subtitle: `Task due${task.due_date === todayStr ? ' today' : ' — overdue'}${lead ? ` · ${lead.first_name} ${lead.last_name}` : ''}`,
      ctaLabel: 'Open',
      ctaHref: task.lead_id ? `/leads/${task.lead_id}?tab=tasks` : '/leads',
      secondaryActions: [
        { label: 'Complete', action: 'complete_task' },
        { label: 'Reschedule', action: 'reschedule_task' },
      ],
      metadata: { taskId: task.id, leadId: task.lead_id ?? null },
    });
  }

  // ── 5. Incomplete applications (priority 5) ────────────────────────────────
  for (const lead of allLeads) {
    if (lead.stage !== 'application') continue;
    if (lead.application_submitted_at) continue;
    actions.push({
      id: `app-${lead.id}`,
      type: 'app_incomplete',
      priority: 5,
      leadId: lead.id,
      leadName: `${lead.first_name} ${lead.last_name}`,
      title: `${lead.first_name} ${lead.last_name}'s application is incomplete`,
      subtitle: 'Missing required fields to process',
      ctaLabel: 'Resume',
      ctaHref: `/leads/${lead.id}?tab=application`,
      metadata: { leadId: lead.id },
    });
  }

  // Sort by priority, cap at 12
  const sortedActions = actions.sort((a, b) => a.priority - b.priority).slice(0, 12);

  // Tomorrow preview
  const tomorrowItems: TomorrowItem[] = (tomorrowTasks ?? []).map((t) => {
    const lead = allLeads.find((l) => l.id === t.lead_id);
    return {
      label: `${t.title}${lead ? ` — ${lead.last_name}` : ''}`,
      href: t.lead_id ? `/leads/${t.lead_id}?tab=tasks` : '/leads',
    };
  });

  // CTC leads closing soon
  const ctcLeads = allLeads
    .filter((l) => l.stage === 'clear_to_close' && l.closing_date)
    .slice(0, 2)
    .map((l) => ({
      label: `${l.last_name} closing — ${format(new Date(l.closing_date!), 'MMM d')}`,
      href: `/leads/${l.id}`,
    }));

  const allTomorrow = [...tomorrowItems, ...ctcLeads].slice(0, 3);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.first_name ?? '';

  return (
    <TodayClient
      actions={sortedActions}
      tomorrowItems={allTomorrow}
      dateLabel={format(now, 'EEEE, MMMM d')}
      greeting={greeting}
      firstName={firstName}
    />
  );
}
