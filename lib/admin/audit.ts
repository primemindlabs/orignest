/**
 * Phase 37 — admin audit logging (INSERT-only, service-role).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function logAdminAction(entry: {
  actor_id: string;
  action: string;
  org_id?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  await sb.from('admin_audit_log').insert({
    actor_id: entry.actor_id,
    action: entry.action,
    org_id: entry.org_id ?? null,
    target_id: entry.target_id ?? null,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
  }).then(() => undefined, () => undefined);
}
