/** Phase 130 — shared access check for Business Pulse API routes (BM/Admin + Team tier). */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgContext } from '@/lib/auth/orgContext';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature, type EffectiveTier } from '@/lib/billing/features';
import { resolveLoProfile } from '@/lib/autopilot/loContext';

export type PulseContext =
  | { ok: false; status: number; error: string }
  | { ok: true; orgId: string; profileId: string | null; locked: boolean; tier: EffectiveTier };

export async function getPulseContext(sb: SupabaseClient): Promise<PulseContext> {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!orgId) return { ok: false, status: 403, error: 'No org' };
  if (!['admin', 'branch_manager'].includes(role)) {
    return { ok: false, status: 403, error: 'Branch manager access required' };
  }
  const tier = await resolveOrgTier(orgId);
  const locked = !hasFeature(tier, 'business_pulse');
  const profile = await resolveLoProfile(sb, userId);
  return { ok: true, orgId, profileId: profile?.id ?? null, locked, tier };
}
