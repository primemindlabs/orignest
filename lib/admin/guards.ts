/**
 * Phase 37 — admin access guards (server-only).
 *
 * Platform admin = member of the PrimeMind internal Clerk org with the
 * platform_admin role. NEVER derived from tenant metadata. Returns 404 (not 403)
 * so the route's existence is never revealed. Inert until PRIMEMIND_ADMIN_ORG_ID
 * is set (then real PrimeMind staff get in).
 */
import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';

export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const { userId, orgId, orgRole } = await auth();
  const adminOrg = process.env.PRIMEMIND_ADMIN_ORG_ID;
  if (!userId || !adminOrg || orgId !== adminOrg || orgRole !== 'org:platform_admin') {
    notFound();
  }
  return { userId };
}

/** Tenant admin = a branch_manager/admin of the current org. */
export async function requireTenantAdmin(): Promise<{ userId: string; orgId: string; role: string }> {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId || !orgId || !['admin', 'branch_manager'].includes(role)) {
    notFound();
  }
  return { userId, orgId, role };
}
