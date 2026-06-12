/**
 * Phase 133 — resolve a user's role for the app. Server-only.
 *
 * The canonical role source is the new `user_roles` table (gives role +
 * assigned_lo_id for LOAs). For users provisioned before Phase 133 it falls back
 * to the existing `profiles.role` (free TEXT), normalized to an AppRole. This
 * bridges the old single-column model and the new table without a backfill.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeRole, type AppRole } from '@/lib/navigation/roles';

type Admin = ReturnType<typeof createAdminClient>;

export interface ResolvedRole {
  profileId: string | null;
  role: AppRole;
  assignedLoId: string | null;
  source: 'user_roles' | 'profiles' | 'default';
}

/** Resolve by Clerk user id (the value getOrgContext().userId returns). */
export async function getRoleForUser(sb: Admin, clerkUserId: string, orgId: string): Promise<ResolvedRole> {
  const { data: profile } = await sb
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (!profile) return { profileId: null, role: 'lo', assignedLoId: null, source: 'default' };

  // Active user_roles row wins (most-privileged if multiple).
  const { data: roles } = await sb
    .from('user_roles')
    .select('role, assigned_lo_id')
    .eq('user_id', profile.id)
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (roles && roles.length > 0) {
    const PRIORITY: AppRole[] = ['admin', 'branch_manager', 'lo', 'loa', 'processor'];
    const sorted = [...roles].sort(
      (a, b) => PRIORITY.indexOf(normalizeRole(a.role)) - PRIORITY.indexOf(normalizeRole(b.role)),
    );
    const top = sorted[0];
    return {
      profileId: profile.id,
      role: normalizeRole(top.role),
      assignedLoId: (top.assigned_lo_id as string | null) ?? null,
      source: 'user_roles',
    };
  }

  return { profileId: profile.id, role: normalizeRole(profile.role), assignedLoId: null, source: 'profiles' };
}
