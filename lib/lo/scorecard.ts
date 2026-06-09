/**
 * Phase 50.9 — LO scorecard: production metrics aggregated from the LO's own
 * leads. No PII — counts and sums only. Server-only.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const ACTIVE = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
const SUBMITTED = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
const CTC = ['clear_to_close', 'closed'];

export interface LOScorecard {
  apps_taken: number; loans_submitted: number; loans_closed: number; volume_funded: number;
  pull_through_rate: number; ctc_rate: number; avg_app_to_close_days: number | null;
  pipeline_active: number; pipeline_value: number;
  deal_types: Record<string, number>;
  funnel: { apps: number; submitted: number; ctc: number; closed: number };
}

function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export async function buildLOScorecard(orgId: string, profileId: string, sinceISO: string): Promise<LOScorecard> {
  const sb = createAdminClient();
  const { data: leads } = await sb
    .from('leads')
    .select('stage, loan_amount, loan_type, application_submitted_at, closed_date, created_at')
    .eq('org_id', orgId)
    .eq('assigned_to', profileId)
    .is('archived_at', null)
    .limit(2000);

  const all = leads ?? [];
  const inPeriod = (d?: string | null) => d != null && d >= sinceISO;

  const appsTaken = all.filter((l) => inPeriod(l.application_submitted_at ?? l.created_at)).length;
  const closedInPeriod = all.filter((l) => l.stage === 'closed' && inPeriod(l.closed_date));
  const submitted = all.filter((l) => SUBMITTED.includes(l.stage));
  const ctc = all.filter((l) => CTC.includes(l.stage));
  const active = all.filter((l) => ACTIVE.includes(l.stage));

  const volume = closedInPeriod.reduce((s, l) => s + Number(l.loan_amount ?? 0), 0);
  const cycles = closedInPeriod.map((l) => daysBetween(l.application_submitted_at ?? l.created_at, l.closed_date)).filter((n): n is number => n != null && n >= 0);
  const avgCycle = cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;

  const dealTypes: Record<string, number> = {};
  for (const l of closedInPeriod) { const t = l.loan_type ?? 'other'; dealTypes[t] = (dealTypes[t] ?? 0) + 1; }

  const apps = Math.max(appsTaken, submitted.length);
  return {
    apps_taken: appsTaken, loans_submitted: submitted.length, loans_closed: closedInPeriod.length, volume_funded: volume,
    pull_through_rate: apps > 0 ? closedInPeriod.length / apps : 0,
    ctc_rate: submitted.length > 0 ? ctc.length / submitted.length : 0,
    avg_app_to_close_days: avgCycle,
    pipeline_active: active.length, pipeline_value: active.reduce((s, l) => s + Number(l.loan_amount ?? 0), 0),
    deal_types: dealTypes,
    funnel: { apps, submitted: submitted.length, ctc: ctc.length, closed: closedInPeriod.length },
  };
}
