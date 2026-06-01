import { createAdminClient } from '@/lib/supabase/admin';
import { AuditAction } from '@/types';

export type { AuditAction };

interface WriteAuditEventParams {
  actorId: string;
  orgId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an immutable audit event to the audit_events table.
 *
 * The audit_events table has INSERT-only RLS — no UPDATE or DELETE
 * is permitted even by the service role. This creates an append-only
 * audit trail required for GLBA, ECOA, and fair lending compliance.
 *
 * Call this from every Server Action and API route that mutates data.
 */
export async function writeAuditEvent(params: WriteAuditEventParams): Promise<void> {
  const sb = createAdminClient();

  const { error } = await sb.from('audit_events').insert({
    actor_id: params.actorId,
    org_id: params.orgId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    before_state: params.beforeState ?? null,
    after_state: params.afterState ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    // Audit write failure is critical — log to console (Sentry will capture)
    // Do NOT throw here in most cases: we don't want a failed audit write
    // to prevent the underlying operation from completing. Instead, alert.
    console.error('[AUDIT] Failed to write audit event:', {
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      error: error.message,
    });
  }
}

/**
 * Write a PII access log entry. Called whenever SSN, income, credit score,
 * or DOB is decrypted and returned to a user.
 */
export async function logPIIAccess(params: {
  accessorId: string;
  orgId: string;
  leadId: string;
  fieldsAccessed: string[];
  purpose: string;
  ipAddress?: string;
}): Promise<void> {
  const sb = createAdminClient();

  await sb.from('pii_access_log').insert({
    accessor_id: params.accessorId,
    org_id: params.orgId,
    lead_id: params.leadId,
    fields_accessed: params.fieldsAccessed,
    purpose: params.purpose,
    ip_address: params.ipAddress ?? null,
  });

  // Also write to audit_events for unified audit trail
  await writeAuditEvent({
    actorId: params.accessorId,
    orgId: params.orgId,
    action: 'pii.accessed',
    resourceType: 'lead',
    resourceId: params.leadId,
    afterState: {
      fields: params.fieldsAccessed,
      purpose: params.purpose,
    },
    ipAddress: params.ipAddress,
  });
}

/**
 * Sanitize an object for audit logging — removes PII fields before storing.
 * Never store SSN, income, DOB, or credit scores in audit logs.
 */
export function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const PII_FIELDS = new Set([
    'ssn',
    'ssn_encrypted',
    'ssn_iv',
    'date_of_birth',
    'income',
    'income_encrypted',
    'income_iv',
    'credit_score',
    'credit_score_encrypted',
    'credit_score_iv',
    'password',
    'password_hash',
  ]);

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extract IP address and user agent from a Request object.
 */
export function extractRequestMeta(req: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  const forwarded = req.headers.get('x-forwarded-for');
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : (req.headers.get('x-real-ip') ?? undefined);

  const userAgent = req.headers.get('user-agent') ?? undefined;

  return { ipAddress, userAgent };
}
