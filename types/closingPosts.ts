// Phase 96 — Loan Close Social Post Generator types.

export type PostStatus = 'draft' | 'approved' | 'posted' | 'rejected';
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin';

export interface ClosingPost {
  id: string;
  org_id: string;
  lo_id: string | null;
  lead_id: string;
  generated_copy: string;
  edited_copy: string | null;
  compliance_check_passed: boolean;
  compliance_flags: string[];
  post_status: PostStatus;
  posted_platforms: SocialPlatform[];
  generated_at: string;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface ComplianceCheckResult {
  passed: boolean;
  flags: string[];
  flagged_terms: { term: string; context: string }[];
}

export interface ClosingPostInput {
  city: string;
  state: string;
  loan_type: string; // e.g. "FHA", "VA", "Conventional"
  lo_name: string;
  company_name: string;
  nmls_number: string;
}

export interface LoProfileInfo {
  name: string;
  company: string;
  nmls: string;
}
