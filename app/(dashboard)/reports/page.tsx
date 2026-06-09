import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MetricCard } from '@/components/ui/MetricCard';
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, BarChart3, FileText, ShieldCheck, GitBranch, Gauge, Award, ChevronRight, Download, Mail, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
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

  const emailConfigured = !!process.env.RESEND_API_KEY;

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

      <div>
        <h2 className="text-sm font-semibold text-black mb-3">Call Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { type: 'production', label: 'Production Report', desc: 'Funded volume & units by LO and loan type', icon: BarChart3 },
            { type: 'pl', label: 'P&L Report', desc: 'Gross revenue, LO comp, branch margin', icon: DollarSign },
            { type: 'velocity', label: 'Pipeline Velocity', desc: 'Days to close, lead→app→close timing', icon: Gauge },
            { type: 'fallout', label: 'Fallout & Pull-Through', desc: 'Pull-through rate, fallout by type & source', icon: TrendingDown },
            { type: 'referral', label: 'Referral Sources', desc: 'Best lead sources by closed volume', icon: GitBranch },
            { type: 'scorecard', label: 'LO Scorecard', desc: 'Per-LO performance & response time', icon: Award },
            { type: 'hmda', label: 'HMDA Pre-Report', desc: 'Filing readiness & data gaps', icon: FileText },
            { type: 'compliance', label: 'Compliance Report', desc: 'TCPA & regulatory red flags', icon: ShieldCheck },
          ].map((r) => (
            <Link key={r.type} href={`/reports/${r.type}`} className="flex items-center gap-3 bg-surface rounded-card shadow-card border border-border px-4 py-3.5 hover:bg-fill transition-colors">
              <div className="w-9 h-9 rounded-[10px] bg-blue/10 flex items-center justify-center flex-shrink-0">
                <r.icon size={16} className="text-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black">{r.label}</p>
                <p className="text-xs text-label-2 mt-0.5">{r.desc}</p>
              </div>
              <ChevronRight size={16} className="text-label-3 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-black mb-3">Regulatory Filing</h2>
        <a
          href={`/api/reports/hmda-lar?year=${new Date().getFullYear()}`}
          className="flex items-center gap-3 bg-surface rounded-card shadow-card border border-border px-4 py-3.5 hover:bg-fill transition-colors"
        >
          <div className="w-9 h-9 rounded-[10px] bg-gold/10 flex items-center justify-center flex-shrink-0">
            <Download size={16} className="text-gold-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black">HMDA LAR Export ({new Date().getFullYear()})</p>
            <p className="text-xs text-label-2 mt-0.5">Loan/Application Register CSV — originated, denied &amp; withdrawn loans in FFIEC code format</p>
          </div>
          <ChevronRight size={16} className="text-label-3 flex-shrink-0" />
        </a>
      </div>

      {/* Scheduled email delivery (Phase 9) — credential-gated real disabled state */}
      <div>
        <h2 className="text-sm font-semibold text-black mb-3">Scheduled Delivery</h2>
        <div className="flex items-center gap-3 bg-surface rounded-card shadow-card border border-border px-4 py-3.5">
          <div className="w-9 h-9 rounded-[10px] bg-fill flex items-center justify-center flex-shrink-0">
            {emailConfigured ? (
              <Mail size={16} className="text-gold-700" />
            ) : (
              <Lock size={16} className="text-label-3" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black">Email reports on a schedule</p>
            <p className="text-xs text-label-2 mt-0.5">
              Send any call report to your team weekly or monthly.{' '}
              {!emailConfigured && (
                <span className="font-mono text-label-3">TODO: set RESEND_API_KEY</span>
              )}
            </p>
          </div>
          <span
            className={`text-[11px] font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${
              emailConfigured ? 'bg-green/10 text-green' : 'text-label-3 border border-border'
            }`}
          >
            {emailConfigured ? 'Available' : 'Not connected'}
          </span>
        </div>
      </div>
    </div>
  );
}