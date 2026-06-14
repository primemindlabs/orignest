/**
 * Phase 127 — Ashley Brain™ route guard.
 * One call resolves the Clerk actor → internal profile id (lo_id) + org, and
 * enforces the Growth-tier feature gate. Returns a ready NextResponse on any
 * failure so routes stay terse: `if (actor instanceof NextResponse) return actor;`.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFeature, FeatureGateError, featureLockedResponse } from '@/lib/billing/featureGate';

export interface BrainActor {
  sb: SupabaseClient;
  orgId: string;
  loId: string;
}

export async function requireBrain(): Promise<BrainActor | NextResponse> {
  const { userId, orgId } = await getOrgContext();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (!profile?.id) {
    return NextResponse.json({ error: 'No profile for user' }, { status: 403 });
  }

  try {
    await requireFeature(orgId, 'ashley_brain');
  } catch (e) {
    if (e instanceof FeatureGateError) {
      return NextResponse.json(featureLockedResponse(e), { status: 403 });
    }
    throw e;
  }

  return { sb, orgId, loId: profile.id as string };
}
