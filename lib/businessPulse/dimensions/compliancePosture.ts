/**
 * Pulse dimension — Compliance Posture (15%).
 * Blends the factors that are actually tracked: TRID compliance (Phase 84 trid_events),
 * NMLS license currency (Phase 50 lo_licenses), and required-training completion
 * (Phase 54 course_completions). Untracked factors are excluded rather than penalized;
 * if nothing is tracked, posture defaults to a clean-but-unverified baseline.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clamp, type DimensionResult } from '../types';

const LO_ROLES = ['loan_officer', 'branch_manager'];
const UNTRACKED_BASELINE = 80;

export async function compliancePosture(sb: SupabaseClient, orgId: string): Promise<DimensionResult> {
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profiles }, { data: trid }, { data: licenses }] = await Promise.all([
    sb.from('profiles').select('id, role').eq('org_id', orgId),
    sb.from('trid_events').select('is_compliant').eq('org_id', orgId),
    sb.from('lo_licenses').select('user_id, status, expiry_date').eq('org_id', orgId),
  ]);

  const loIds = (profiles ?? []).filter((p: any) => LO_ROLES.includes(p.role)).map((p: any) => p.id as string);
  const totalLOs = loIds.length;

  // Training completions for this org's LOs.
  let completions: { user_id: string; status: string }[] = [];
  if (loIds.length) {
    const { data } = await sb.from('course_completions').select('user_id, status').in('user_id', loIds);
    completions = (data ?? []) as { user_id: string; status: string }[];
  }

  const factors: number[] = [];

  // TRID compliance.
  const tridRows = (trid ?? []) as { is_compliant: boolean }[];
  let tridPct: number | null = null;
  if (tridRows.length) {
    tridPct = Math.round((tridRows.filter((t) => t.is_compliant).length / tridRows.length) * 100);
    factors.push(tridPct);
  }

  // NMLS license currency.
  const licRows = (licenses ?? []) as { user_id: string; status: string; expiry_date: string }[];
  let nmlsPct: number | null = null;
  if (licRows.length) {
    const tracked = new Set(licRows.map((l) => l.user_id));
    const current = new Set(licRows.filter((l) => l.status === 'active' && l.expiry_date > today).map((l) => l.user_id));
    nmlsPct = tracked.size > 0 ? Math.round((current.size / tracked.size) * 100) : null;
    if (nmlsPct != null) factors.push(nmlsPct);
  }

  // Training completion.
  let trainingPct: number | null = null;
  if (completions.length && totalLOs > 0) {
    const done = new Set(completions.filter((c) => c.status === 'completed' || c.status === 'passed').map((c) => c.user_id));
    trainingPct = Math.round((done.size / totalLOs) * 100);
    factors.push(trainingPct);
  }

  const score = factors.length ? Math.round(factors.reduce((a, b) => a + b, 0) / factors.length) : UNTRACKED_BASELINE;

  return {
    score: clamp(score),
    details: {
      trid_compliance_pct: tridPct,
      trid_event_count: tridRows.length,
      los_total: totalLOs,
      nmls_current_pct: nmlsPct,
      training_completion_pct: trainingPct,
    },
  };
}
