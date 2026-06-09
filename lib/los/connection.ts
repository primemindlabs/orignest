/**
 * Phase 41 — LOS connection helpers + sync-event logging (server-only).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';

export type LosType = 'lendingpad' | 'arive' | 'encompass' | 'byte';

export interface LosConnection {
  id: string;
  org_id: string;
  los_type: LosType;
  api_key_enc: string | null;
  api_secret_enc: string | null;
  webhook_secret: string | null;
  base_url: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

export async function getLosConnection(orgId: string, losType: LosType): Promise<LosConnection | null> {
  const sb = createAdminClient();
  const { data } = await sb.from('los_connections').select('*').eq('org_id', orgId).eq('los_type', losType).eq('is_active', true).maybeSingle();
  return (data as LosConnection) ?? null;
}

/** Decrypt the stored API key/secret at call time. Never returns to the client. */
export async function getLosCredentials(orgId: string, losType: LosType): Promise<{ apiKey: string; apiSecret: string | null } | null> {
  const conn = await getLosConnection(orgId, losType);
  if (!conn?.api_key_enc) return null;
  return { apiKey: decrypt(conn.api_key_enc), apiSecret: conn.api_secret_enc ? decrypt(conn.api_secret_enc) : null };
}

export async function logSyncEvent(opts: {
  orgId: string; losType: string; losLoanId?: string | null; eventType: string;
  direction: 'inbound' | 'outbound'; payload?: unknown; result: 'success' | 'error' | 'skipped'; error?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  await sb.from('los_sync_events').insert({
    org_id: opts.orgId, los_type: opts.losType, los_loan_id: opts.losLoanId ?? null,
    event_type: opts.eventType, direction: opts.direction, payload: opts.payload ?? null,
    result: opts.result, error_message: opts.error ?? null,
  }).then(() => undefined, () => undefined);
}
