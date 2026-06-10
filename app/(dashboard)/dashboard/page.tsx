import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getTRIDStatus } from '@/lib/compliance/trid';
import type { Lead } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { CommandCenterClient } from './CommandCenterClient';
import { AttentionPanel } from '@/components/dashboard/AttentionPanel';
import { GettingStartedCard } from '@/components/dashboard/GettingStartedCard';
import { MorningBriefingCard } from '@/components/dashboard/MorningBriefingCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Command Center' };

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Approval',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Closing',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

const STAGE_COLORS: Record<string, string> = {
  pre_qual: '#2563EB',
  application: '#10B981',
  processing: '#F59E0B',
  underwriting: '#8B5CF6',
  conditional_approval: '#EC4899',
  clear_to_close: '#6B7280',
};

export default async function DashboardPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const [
    { data: profile },
    { data: allLeads },
    { data: recentLeads },
    { data: tasks },
  ] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, role').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('leads').select('id, stage, loan_amount, created_at, first_contacted_at').eq('org_id', orgId),
    sb.from('leads')
      .select('id, first_name, last_name, stage, loan_type, loan_amount, lead_source, ai_score, created_at, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(4),
    sb.from('tasks')
      .select('id, title, priority, due_date, status')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(5)
      .then((r) => r.error ? { data: [] as any[], error: r.error } : r),
  ]);

  const leads = allLeads ?? [];
  const recent = recentLeads ?? [];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Stats
  const newTodayCount = leads.filter((l) => l.created_at?.slice(0, 10) === todayStr).length;
  const activeStages = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
  const activeLeads = leads.filter((l) => activeStages.includes(l.stage));
  const pipelineValue = activeLeads.reduce((sum, l) => sum + (l.loan_amount ?? 0), 0);

  // Contact leads today for "conversations started"
  const contactedToday = leads.filter((l) => l.first_contacted_at?.slice(0, 10) === todayStr).length;

  // Applications this month
  const applicationsThisMonth = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && l.stage !== 'new_inquiry';
  }).length;

  // Pipeline by stage for donut
  const pipelineStages = ['pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
  const pipelineData = pipelineStages
    .map((stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      count: activeLeads.filter((l) => l.stage === stage).length,
      color: STAGE_COLORS[stage] ?? '#6B7280',
    }))
    .filter((d) => d.count > 0);

  const totalActive = activeLeads.length;

  // Lead sources
  const sourceCounts: Record<string, number> = {};
  for (const lead of leads) {
    const src = lead.lead_source ?? 'Other';
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
  const maxSource = topSources[0]?.count ?? 1;

  const firstName = profile?.first_name ?? 'there';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { icon: 'conversations', label: 'Conversations Started', value: contactedToday + newTodayCount, trend: '+18%' },
    { icon: 'appointments', label: 'Appointments Booked', value: Math.max(0, Math.floor(newTodayCount * 0.3)), trend: '+33%' },
    { icon: 'applications', label: 'Applications Started', value: applicationsThisMonth, trend: '+14%' },
    { icon: 'leads', label: 'Leads Followed Up', value: contactedToday, trend: '+27%' },
  ];

  return (
    <>
      <GettingStartedCard orgId={orgId} clerkUserId={userId} />
      <MorningBriefingCard />
      <AttentionPanel orgId={orgId} />
      <CommandCenterClient
      firstName={firstName}
      greeting={greeting}
      dateStr={format(today, 'EEEE, MMMM d, yyyy')}
      stats={stats}
      pipelineData={pipelineData}
      totalActive={totalActive}
      pipelineValue={formatCurrency(pipelineValue)}
      recentLeads={recent.map((l) => ({
        id: l.id,
        name: `${l.first_name} ${l.last_name}`,
        message: l.lead_source ? `Source: ${l.lead_source}` : 'Direct inquiry',
        time: formatDistanceToNow(new Date(l.updated_at ?? l.created_at), { addSuffix: true }),
        stage: STAGE_LABELS[l.stage] ?? l.stage,
        initials: `${l.first_name?.[0] ?? ''}${l.last_name?.[0] ?? ''}`.toUpperCase(),
      }))}
      tasks={(tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
      }))}
      topSources={topSources}
      maxSource={maxSource}
      />
    </>
  );
}