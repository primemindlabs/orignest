/**
 * Best-effort agent/cron execution telemetry. SERVER-ONLY.
 *
 * Writes one row to agent_run_log per agent run so the AI Agents dashboard can show
 * real last-run / records-processed / status instead of hardcoded values. Swallows
 * all errors (incl. the table not existing yet, while its migration is pending) so a
 * telemetry write can never break the agent it's measuring.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgentRunStatus = 'completed' | 'failed' | 'running';

export async function logAgentRun(
  sb: SupabaseClient,
  run: { orgId?: string | null; agentName: string; status?: AgentRunStatus; recordsProcessed?: number; errorMessage?: string | null },
): Promise<void> {
  try {
    await sb.from('agent_run_log').insert({
      org_id: run.orgId ?? null,
      agent_name: run.agentName,
      status: run.status ?? 'completed',
      records_processed: run.recordsProcessed ?? 0,
      error_message: run.errorMessage ?? null,
    });
  } catch {
    /* table may not exist yet (migration pending) — telemetry is best-effort */
  }
}
