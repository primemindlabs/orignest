/**
 * Phase 147 — provider-agnostic origination credit pull types. SERVER-ONLY.
 */
import 'server-only';

export type CreditVendor = 'generic' | 'factual_data' | 'cbc' | 'meridianlink' | 'xactus' | 'credco';

export interface CreditConnection {
  id: string;
  org_id: string;
  vendor: CreditVendor;
  api_url: string | null;
  auth_type: 'basic' | 'bearer' | 'api_key' | 'none';
  account_id: string | null;
}

export interface DecryptedCreds { apiKey: string | null; apiSecret: string | null }

export interface CreditApplicant {
  firstName: string;
  lastName: string;
  ssn?: string;
  dob?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface CreditPullInput {
  pullType: 'soft' | 'hard';
  applicant: CreditApplicant;
}

export interface CreditScores {
  equifax?: number | null;
  experian?: number | null;
  transunion?: number | null;
}

export interface CreditPullResult {
  gated?: boolean;
  status: 'completed' | 'error' | 'gated';
  scores?: CreditScores;
  reportRef?: string | null;
  tradelineCount?: number | null;
  raw?: Record<string, unknown> | null;
  error?: string;
}

export interface CreditAdapter {
  vendor: CreditVendor;
  pull(conn: CreditConnection, creds: DecryptedCreds, input: CreditPullInput): Promise<CreditPullResult>;
}

/** Middle of three bureau scores; lower of two; the one if only one. */
export function midScore(s: CreditScores): number | null {
  const vals = [s.equifax, s.experian, s.transunion].filter((v): v is number => typeof v === 'number' && v > 0).sort((a, b) => a - b);
  if (vals.length === 3) return vals[1];
  if (vals.length === 2) return vals[0];
  if (vals.length === 1) return vals[0];
  return null;
}
