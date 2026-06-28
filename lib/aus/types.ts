/**
 * Phase 151 — provider-agnostic AUS (Automated Underwriting System) types. SERVER-ONLY.
 *
 * Submits the MISMO 3.4 (ULAD) URLA file to an AUS — Fannie Mae's Desktop Underwriter
 * (DU) or Freddie Mac's Loan Product Advisor (LPA) — and parses back the underwriting
 * recommendation + findings. Same gated-adapter shape as the credit pull (P147),
 * VOI/VOE (P150), and wholesale submission (P143) layers: per-org encrypted vendor
 * credentials, inert until a real AUS endpoint is connected.
 */
import 'server-only';

export type AusVendor = 'generic' | 'fannie_du' | 'freddie_lpa';
/** Which AUS the run targets. DU = Fannie, LPA = Freddie. */
export type AusSystem = 'du' | 'lpa';

/**
 * Canonical, system-agnostic recommendation. The vendor's exact wording is also kept
 * (rawRecommendation). DU separates the recommendation from the eligibility leg, so
 * eligibility is tracked independently.
 *   DU:  Approve/Eligible, Approve/Ineligible, Refer, Refer w/ Caution, Out of Scope
 *   LPA: Accept, Caution, Ineligible, Incomplete, Invalid, Out of Scope
 */
export type AusRecommendation =
  | 'approve'             // DU Approve · LPA Accept's underwriting leg
  | 'accept'             // LPA Accept
  | 'refer'              // DU Refer
  | 'refer_with_caution' // DU Refer with Caution
  | 'caution'            // LPA Caution
  | 'ineligible'         // ineligible for the program
  | 'out_of_scope'       // out of scope for the AUS
  | 'incomplete'         // LPA Incomplete / missing data
  | 'error'
  | 'pending'
  | 'unknown';

export interface AusConnection {
  id: string;
  org_id: string;
  vendor: AusVendor;
  api_url: string | null;
  auth_type: 'basic' | 'bearer' | 'api_key' | 'none';
  account_id: string | null;
}

export interface DecryptedCreds { apiKey: string | null; apiSecret: string | null }

export interface AusInput {
  system: AusSystem;
  mismoXml: string;
  borrowerLastName?: string | null;
  loanAmount?: number | null;
}

/** One underwriting message: a condition, observation, or verification message. */
export interface AusFinding {
  code?: string | null;
  category?: string | null;   // credit / income / assets / property / observation …
  severity?: string | null;   // condition / observation / verification / warning
  text: string;
}

export interface AusResult {
  /** true when nothing was transmitted (no live endpoint/creds). */
  gated?: boolean;
  status: 'completed' | 'error' | 'gated' | 'pending';
  recommendation?: AusRecommendation | null;
  rawRecommendation?: string | null;     // vendor's exact wording
  eligibility?: 'eligible' | 'ineligible' | null;
  riskClass?: string | null;             // LPA risk class / DU risk assessment
  caseFileId?: string | null;            // DU Casefile ID / LPA AUS Key Number
  dti?: number | null;
  ltv?: number | null;
  findings?: AusFinding[];
  reportRef?: string | null;             // findings-report reference id
  raw?: Record<string, unknown> | null;
  error?: string;
}

export interface AusAdapter {
  vendor: AusVendor;
  submit(conn: AusConnection, creds: DecryptedCreds, input: AusInput): Promise<AusResult>;
}
