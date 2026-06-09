/**
 * Phase 31.2d — Platform Operator Data Access Policy.
 *
 * PrimeMind (the platform operator) does NOT access tenant loan data. This file
 * is the single source of truth for what a `platform_admin` may and may not do.
 *
 * Enforcement note for THIS codebase: the app authenticates with Clerk and reads
 * via the service-role admin client (which bypasses Postgres RLS). Therefore the
 * real enforcement boundary is operational — the service-role key is never issued
 * to platform-admin operators, and any platform-admin tooling must call only the
 * ALLOWED surfaces below. The capability lists here are imported by admin tooling
 * to gate features; they are intentionally restrictive.
 */

export const PLATFORM_ADMIN_ALLOWED = [
  'aggregate_metrics', // loan counts, user counts, revenue — counts only
  'billing_subscription',
  'tenant_configuration',
  'sanitized_error_logs', // no PII
] as const;

export const PLATFORM_ADMIN_DENIED = [
  'read_loan_files',
  'read_borrower_data',
  'read_income_credit_dti_assets',
  'read_documents',
  'read_chat_messages',
  'access_borrower_portal_session',
  'access_realtor_portal_session',
  'impersonate_lo_without_consent',
] as const;

export type PlatformAdminCapability = (typeof PLATFORM_ADMIN_ALLOWED)[number];

export function platformAdminCan(capability: string): capability is PlatformAdminCapability {
  return (PLATFORM_ADMIN_ALLOWED as readonly string[]).includes(capability);
}
