/**
 * Shared domain types for Orignest (Conduit Next).
 * This is the canonical type source — imported as `@/types`.
 */

export type UserRole = 'admin' | 'branch_manager' | 'loan_officer' | 'processor';

export type LeadStage =
  | 'new_inquiry'
  | 'pre_qual'
  | 'application'
  | 'processing'
  | 'underwriting'
  | 'conditional_approval'
  | 'clear_to_close'
  | 'closed'
  | 'declined'
  | 'withdrawn';

export type LoanType =
  | 'conventional'
  | 'fha'
  | 'va'
  | 'usda'
  | 'jumbo'
  | 'non_qm'
  | 'heloc'
  | 'construction'
  | 'reverse'
  | 'commercial'
  | 'dscr';

export type LoanPurpose =
  | 'purchase'
  | 'rate_term_refinance'
  | 'cash_out_refinance'
  | 'heloc'
  | 'construction';

// ─── Loan Conditions ──────────────────────────────────────────────────────────

export type ConditionCategory =
  | 'income'
  | 'credit'
  | 'assets'
  | 'property'
  | 'title'
  | 'insurance'
  | 'appraisal'
  | 'other';

export type ConditionPriority = 'ptd' | 'ptc' | 'pf' | 'informational';

export type ConditionStatus = 'outstanding' | 'submitted' | 'cleared' | 'waived';

export interface LoanCondition {
  id: string;
  org_id: string;
  lead_id: string;
  condition_text: string;
  category: ConditionCategory;
  priority: ConditionPriority;
  status: ConditionStatus;
  assigned_to: string | null;
  due_date: string | null;
  submitted_at: string | null;
  cleared_at: string | null;
  notes: string | null;
  document_id: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Loan Milestones ──────────────────────────────────────────────────────────

export interface LoanMilestone {
  id: string;
  org_id: string;
  lead_id: string;
  milestone_key: string;
  milestone_label: string;
  loan_type_applicable: string[] | null;
  display_order: number;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Processor Cross-Tenant ───────────────────────────────────────────────────

export type ProcessorAssignmentStatus = 'pending' | 'active' | 'suspended';

export interface ProcessorAssignment {
  id: string;
  processor_clerk_id: string;
  org_id: string;
  invited_by: string;
  status: ProcessorAssignmentStatus;
  permissions: ProcessorPermissions;
  accepted_at: string | null;
  created_at: string;
}

export interface ProcessorPermissions {
  view_leads: boolean;
  edit_conditions: boolean;
  upload_docs: boolean;
  view_financials: boolean;
}

export interface ProcessorFileAssignment {
  id: string;
  processor_clerk_id: string;
  lead_id: string;
  org_id: string;
  assigned_by: string | null;
  active: boolean;
  assigned_at: string;
}

// ─── AI Learning ──────────────────────────────────────────────────────────────

export type AIUserAction = 'accepted' | 'rejected' | 'modified' | 'ignored';

export interface AIInteraction {
  id: string;
  org_id: string | null;
  user_id: string;
  lead_id: string | null;
  agent_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  user_action: AIUserAction | null;
  created_at: string;
}

export interface OrgAIContext {
  avgLeadScore: number;
  topLeadSources: string[];
  avgDaysToClose: number;
  topLoanTypes: string[];
  commonConditions: string[];
  bestContactTimes: string[];
  conversionRateByStage: Record<string, number>;
}

export interface OrgLeadWeights {
  sourceWeights: Record<string, number>;
  loanTypeWeights: Record<string, number>;
  creditScoreWeights: Record<string, number>;
}
