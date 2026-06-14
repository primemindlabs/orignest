/** Phase 131 — Goldmine access context (any LO, Pro/Growth tier). */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgContext } from '@/lib/auth/orgContext';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature, type EffectiveTier } from '@/lib/billing/features';
import { resolveLoProfile } from '@/lib/autopilot/loContext';

export type GoldmineAccess =
  | { ok: false; status: number; error: string }
  | { ok: true; orgId: string; loId: string; loFirstName: string; compRate: number | null; locked: boolean; tier: EffectiveTier };

export async function getGoldmineAccess(sb: SupabaseClient): Promise<GoldmineAccess> {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!orgId) return { ok: false, status: 403, error: 'No org' };

  const tier = await resolveOrgTier(orgId);
  const locked = !hasFeature(tier, 'database_goldmine');
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return { ok: false, status: 403, error: 'No profile' };

  // comp_rate lives on profiles (Phase 74); resolveLoProfile doesn't select it.
  const { data: extra } = await sb.from('profiles').select('comp_rate').eq('id', profile.id).maybeSingle();
  const compRate = (extra as { comp_rate: number | null } | null)?.comp_rate ?? null;

  return { ok: true, orgId, loId: profile.id, loFirstName: profile.first_name ?? '', compRate, locked, tier };
}
