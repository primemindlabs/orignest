// Phase 82 — Loan File AI shared types.

export type LoanAIContext = {
  lead_id: string;
  stage: string | null;
  borrower_name: string; // first name only — never full name / SSN / DOB
  loan_amount: number | null;
  loan_type: string | null;
  loan_purpose: string | null;
  property_address: string | null;
  occupancy_type: string | null;
  credit_score: number | null;
  ltv: number | null;
  rate_lock_expiry: string | null;
  rate_lock_rate: number | null;
  trid_le_deadline: string | null;
  trid_cd_deadline: string | null;
  closing_date: string | null;
  conditions_outstanding: string[];
  ghost_score: number | null;
  dti_estimated: number | null;
  last_contact_date: string | null;
  assigned_lo: string | null;
};

export type LoanAIQueryLog = {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  created_at: string;
};
