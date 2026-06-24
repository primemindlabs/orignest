/**
 * Phase 143 — provider-agnostic wholesale submission/lock types. SERVER-ONLY use.
 *
 * Mirrors the LOS (P41) and PPE (P56/P142) adapter shape: a small interface every
 * lender platform implements, and a registry that resolves platform → adapter. The
 * generic_mismo adapter is the real, lowest-common-denominator implementation; the
 * others are structured stubs wired on demand (only their file changes).
 */
import 'server-only';

export type SubmissionPlatform = 'generic_mismo' | 'uwm' | 'rocket_tpo' | 'loanstream' | 'custom';

export interface SubmissionConnection {
  id: string;
  org_id: string;
  lender_name: string;
  platform: SubmissionPlatform;
  submit_url: string | null;
  lock_url: string | null;
  status_url: string | null;
  auth_type: 'bearer' | 'api_key' | 'basic' | 'none';
  base_url: string | null;
}

/** Credentials decrypted at call time — never persisted or returned to a client. */
export interface DecryptedCreds { apiKey: string | null; apiSecret: string | null }

export interface SubmissionPayload {
  loanId: string;
  mismoXml: string;
  borrowerLastName?: string | null;
  loanAmount?: number | null;
}

export type SubmissionStatus =
  | 'queued' | 'submitted' | 'received' | 'in_review'
  | 'suspended' | 'approved' | 'denied' | 'withdrawn' | 'error';

export interface SubmissionResult {
  /** false when nothing was transmitted (no live endpoint/creds). */
  gated?: boolean;
  status: SubmissionStatus;
  externalLoanId?: string | null;
  externalStatus?: string | null;
  responseMeta?: Record<string, unknown> | null;
  error?: string;
}

export interface LockRequest {
  loanId: string;
  action: 'lock' | 'extend' | 'relock' | 'float_down' | 'cancel';
  productName?: string | null;
  requestedRate?: number | null;
  requestedPrice?: number | null;
  lockPeriodDays?: number | null;
  /** The lender's loan reference returned from a prior submission, if any. */
  externalLoanId?: string | null;
}

export type LockStatus = 'requested' | 'confirmed' | 'denied' | 'expired' | 'cancelled' | 'error';

export interface LockResult {
  gated?: boolean;
  status: LockStatus;
  lockNumber?: string | null;
  lockedRate?: number | null;
  lockedPrice?: number | null;
  lockExpiration?: string | null; // ISO date
  externalStatus?: string | null;
  responseMeta?: Record<string, unknown> | null;
  error?: string;
}

export interface LenderAdapter {
  platform: SubmissionPlatform;
  submit(conn: SubmissionConnection, creds: DecryptedCreds, payload: SubmissionPayload): Promise<SubmissionResult>;
  lock(conn: SubmissionConnection, creds: DecryptedCreds, req: LockRequest): Promise<LockResult>;
}
