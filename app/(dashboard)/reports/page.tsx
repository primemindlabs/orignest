import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { MetricCard } from '@/components/ui/MetricCard';
import { TrendingUp, Users, DollarSign, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('role').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle(),
  ]);

  if (profile?.role === 'loan_officer') redirect('/dashboard');

  const { data: leads } = await sb
    .from('leads')
    .select('stage, loan_amount, created_at, last_contacted_at')
    .eq('org_id', org?.id ?? '');

  const allLeads = leads ?? [];
  const closed = allLeads.filter((l) => l.stage === 'closed');
  const active = allLeads.filter((l) =>
    ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'].includes(l.stage)
  );

  const closedVolume = closed.reduce((s, l) => s + (l.loan_amount ?? 0), 0);
  const pipelineValue = active.reduce((s, l) => s + (l.loan_amount ?? 0), 0);
  const conversionRate = allLeads.length > 0 ? (closed.length / allLeads.length) * 100 : 0;

  function formatCurrency(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Reports</h1>
        <p className="text-label-2 text-sm mt-0.5">Pipeline analytics and performance metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Leads"
          value={allLeads.length}
          color="blue"
          icon={<Users size={16} />}
        />
        <MetricCard
          label="Closed Volume"
          value={formatCurrency(closedVolume)}
          color="green"
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          color="gold"
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          label="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          color="neutral"
          icon={<Clock size={16} />}
        />
      </div>

      <div className="bg-surface rounded-card shadow-card border border-border p-6 text-center text-label-2 text-sm">
        <p className="font-medium text-black mb-1">Advanced Reports Coming Soon</p>
        <p>Funnel analysis, fair lending monitoring, HMDA export, and custom date ranges.</p>
      </div>
    </div>
  );
}
