import { UserRole } from '@/types';

export type { UserRole };

type Permission =
  | 'leads:read:own'
  | 'leads:read:branch'
  | 'leads:read:all'
  | 'leads:write:own'
  | 'leads:write:branch'
  | 'leads:write:all'
  | 'leads:assign'
  | 'leads:delete'
  | 'leads:export'
  | 'tasks:write'
  | 'documents:upload'
  | 'documents:delete'
  | 'pii:read'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'campaigns:delete'
  | 'partners:read'
  | 'partners:write'
  | 'partners:delete'
  | 'team:read'
  | 'team:manage'
  | 'team:invite'
  | 'reports:read'
  | 'reports:export'
  | 'ai:use'
  | 'profile:write'
  | 'settings:read'
  | 'settings:write'
  | 'billing:read'
  | 'billing:write'
  | 'admin:audit_log'
  | 'admin:users'
  | 'admin:org';

const PERMISSIONS: Record<UserRole, Set<Permission>> = {
  loan_officer: new Set<Permission>([
    'leads:read:own',
    'leads:write:own',
    'tasks:write',
    'documents:upload',
    'campaigns:read',
    'partners:read',
    'ai:use',
    'profile:write',
    'settings:read',
    'reports:read',
  ]),

  branch_manager: new Set<Permission>([
    'leads:read:own',
    'leads:read:branch',
    'leads:write:own',
    'leads:write:branch',
    'leads:assign',
    'leads:export',
    'tasks:write',
    'documents:upload',
    'documents:delete',
    'campaigns:read',
    'campaigns:write',
    'partners:read',
    'partners:write',
    'team:read',
    'team:manage',
    'team:invite',
    'reports:read',
    'reports:export',
    'ai:use',
    'profile:write',
    'settings:read',
    'settings:write',
  ]),

  admin: new Set<Permission>([
    'leads:read:own',
    'leads:read:branch',
    'leads:read:all',
    'leads:write:own',
    'leads:write:branch',
    'leads:write:all',
    'leads:assign',
    'leads:delete',
    'leads:export',
    'tasks:write',
    'documents:upload',
    'documents:delete',
    'pii:read',
    'campaigns:read',
    'campaigns:write',
    'campaigns:delete',
    'partners:read',
    'partners:write',
    'partners:delete',
    'team:read',
    'team:manage',
    'team:invite',
    'reports:read',
    'reports:export',
    'ai:use',
    'profile:write',
    'settings:read',
    'settings:write',
    'billing:read',
    'billing:write',
    'admin:audit_log',
    'admin:users',
    'admin:org',
  ]),

  // Processor — cross-tenant ops role: works conditions/docs on assigned files,
  // no commission/billing/admin or lead-ownership writes.
  processor: new Set<Permission>([
    'leads:read:own',
    'tasks:write',
    'documents:upload',
    'ai:use',
    'profile:write',
    'settings:read',
  ]),
};

/**
 * Check if a role has a given permission.
 */
export function can(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Server-side permission guard — throws if the role lacks permission.
 * Use this in Server Actions and API routes before mutating data.
 */
export function requirePermission(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new UnauthorizedError(
      `Role "${role}" does not have permission to perform "${permission}".`
    );
  }
}

/**
 * Check multiple permissions at once (AND logic — all must be true).
 */
export function canAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/**
 * Check if a role has ANY of the given permissions (OR logic).
 */
export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/**
 * Get the Supabase RLS scope for reading leads based on role.
 * Used to build queries that respect the permission model.
 */
export function getLeadReadScope(role: UserRole): 'own' | 'branch' | 'all' {
  if (role === 'admin') return 'all';
  if (role === 'branch_manager') return 'branch';
  return 'own';
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
