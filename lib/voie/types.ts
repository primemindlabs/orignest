/**
 * Phase 150 — provider-agnostic VOI/VOE (income & employment verification) types.
 * SERVER-ONLY.
 */
import 'server-only';

export type VoieVendor = 'generic' | 'truework' | 'the_work_number' | 'plaid_income';
export type VerificationType = 'income' | 'employment' | 'both';
export type VoieMethod = 'instant' | 'manual';

export interface VoieConnection {
  id: string;
  org_id: string;
  vendor: VoieVendor;
  api_url: string | null;
  auth_type: 'basic' | 'bearer' | 'api_key' | 'none';
  account_id: string | null;
}

export interface DecryptedCreds { apiKey: string | null; apiSecret: string | null }

export interface VoieApplicant {
  firstName: string;
  lastName: string;
  ssn?: string;
  dob?: string;
  employerName?: string;
  jobTitle?: string;
}

export interface VoieInput {
  verificationType: VerificationType;
  method: VoieMethod;
  applicant: VoieApplicant;
}

export interface VoieEmployment {
  employerName?: string | null;
  jobTitle?: string | null;
  status?: string | null;       // active / terminated / on_leave
  startDate?: string | null;
  endDate?: string | null;
}

export interface VoieIncome {
  annualIncome?: number | null;
  monthlyIncome?: number | null;
  payFrequency?: string | null;
}

export interface VoieResult {
  gated?: boolean;
  status: 'completed' | 'error' | 'gated' | 'pending';
  verified?: boolean;
  employment?: VoieEmployment;
  income?: VoieIncome;
  reportRef?: string | null;
  raw?: Record<string, unknown> | null;
  error?: string;
}

export interface VoieAdapter {
  vendor: VoieVendor;
  verify(conn: VoieConnection, creds: DecryptedCreds, input: VoieInput): Promise<VoieResult>;
}
