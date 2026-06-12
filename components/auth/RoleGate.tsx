'use client';

/**
 * Phase 133 — RoleGate: conditionally render by the current user's role.
 *   <RoleGate allow={['lo','branch_manager','admin']}><CompCalculator/></RoleGate>
 *   <RoleGate allow="processor" fallback={<p>Not available for your role</p>}>…</RoleGate>
 * Renders nothing while the role is still loading (avoids a flash of gated UI).
 */
import type { ReactNode } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import type { AppRole } from '@/lib/navigation/roles';

type Props = {
  allow: AppRole | AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function RoleGate({ allow, children, fallback = null }: Props) {
  const { role, loading } = useUserRole();
  if (loading) return null;
  const allowed = Array.isArray(allow) ? allow : [allow];
  return allowed.includes(role) ? <>{children}</> : <>{fallback}</>;
}
