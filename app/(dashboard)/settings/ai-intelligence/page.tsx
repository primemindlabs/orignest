import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AI Intelligence' };

function fmt(iso: string | null) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function AiIntelligenceSettingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ count: patternCount }, { data: lastRun }, { count: predictionCount }] = await Promise.all([
    sb.from('uw_outcome_patterns').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    sb.from('uw_pattern_refresh_log').select('patterns_updated, loans_analyzed, ran_at').eq('org_id', orgId).order('ran_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('predicted_conditions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Settings
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">AI Intelligence</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Ashley IQ learns from every loan you close. The underwriting model refreshes weekly and feeds condition prediction, velocity, and risk.
        </p>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-[8px] bg-[var(--c-gold-light)] flex items-center justify-center">
            <Sparkles size={14} className="text-[var(--c-gold-deep)]" />
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Underwriting Outcome Model</h3>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--c-label2)]">Patterns learned</dt>
            <dd className="text-[20px] font-mono tabular-nums font-semibold text-[var(--c-text)]">{patternCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--c-label2)]">Predictions generated</dt>
            <dd className="text-[20px] font-mono tabular-nums font-semibold text-[var(--c-text)]">{predictionCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--c-label2)]">Loans analyzed (last run)</dt>
            <dd className="text-[15px] font-mono tabular-nums text-[var(--c-text)]">{lastRun?.loans_analyzed ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--c-label2)]">Last model update</dt>
            <dd className="text-[13px] text-[var(--c-text)]">{fmt(lastRun?.ran_at ?? null)}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-[var(--c-label2)] mt-4 pt-4 border-t border-[var(--c-border)]">
          Refreshes automatically every Sunday at 3:00 AM UTC. Accuracy improves as more loans reach a final underwriting outcome.
        </p>
      </div>
    </div>
  );
}
