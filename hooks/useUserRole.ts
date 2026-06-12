'use client';

/**
 * Phase 133 — useUserRole: the canonical client role hook.
 * Fetches from /api/me/role (which reads the user_roles table server-side, with
 * a profiles.role fallback). Replaces reading Clerk publicMetadata, which is
 * unreliable in this app (role lives in Supabase, not Clerk metadata).
 */
import { useState, useEffect } from 'react';
import type { AppRole } from '@/lib/navigation/roles';

export interface UserRoleState {
  role: AppRole;
  isLO: boolean;
  isLOA: boolean;
  isProcessor: boolean;
  isBranchManager: boolean;
  isAdmin: boolean;
  assignedLoId: string | null;
  loading: boolean;
}

export function useUserRole(): UserRoleState {
  const [role, setRole] = useState<AppRole>('lo');
  const [assignedLoId, setAssignedLoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/role')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (d.role) setRole(d.role as AppRole);
        setAssignedLoId(d.assigned_lo_id ?? null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return {
    role,
    isLO: role === 'lo',
    isLOA: role === 'loa',
    isProcessor: role === 'processor',
    isBranchManager: role === 'branch_manager',
    isAdmin: role === 'admin',
    assignedLoId,
    loading,
  };
}
