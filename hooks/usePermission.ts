'use client';

import { useUser } from '@clerk/nextjs';
import { can } from '@/lib/rbac';
import type { UserRole } from '@/types';

/**
 * Client-side permission check hook.
 * Role is read from Clerk public metadata (set by the webhook when org membership is created).
 */
export function usePermission(action: string): boolean {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as UserRole | undefined) ?? 'loan_officer';
  // Use the RBAC module for type-safe checks
  return can(role, action as Parameters<typeof can>[1]);
}

/**
 * Returns the current user's role.
 */
export function useRole(): UserRole {
  const { user } = useUser();
  return (user?.publicMetadata?.role as UserRole | undefined) ?? 'loan_officer';
}
