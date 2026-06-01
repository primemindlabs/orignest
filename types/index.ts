// ============================================================
// Conduit CRM — Shared TypeScript Types
// ============================================================

// ---- Enums ----

export type UserRole = 'loan_officer' | 'branch_manager' | 'admin';

export type SubscriptionPlan = 'starter' | 'growth' | 'team';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';

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

export type PropertyType =
  | 'single_family'
  | 'condo'
  | 'townhouse'
  | 'multi_family_2_4'
  | 'multi_family_5plus'
  | 'commercial'
  | 'land';

export type OccupancyType = 'primary_residence' | 'second_home' | 'investment_property';

export type DocumentType =
  | 'w2'
  | 'paystub'
  | 'tax_return_1040'
  | 'bank_statement'
  | 'credit_report'
  | 'appraisal'
  | 'title_commitment'
  | 'purchase_agreement'
  | 'loan_estimate'
  | 'closing_disclosure'
  | 'hud_1'
  | 'flood_cert'
  | 'homeowners_insurance'
  | 'other';

export type CommunicationChannel = 'email' | 'sms' | 'call' | 'note';

export type TRIDStatusValue = 'ok' | 'due_today' | 'overdue' | 'blocked' | 'not_applicable';

export type AuditAction =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'lead.stage_changed'
  | 'document.accessed'
  | 'document.uploaded'
  | 'document.deleted'
  | 'pii.accessed'
  | 'communication.sent'
  | 'user.signed_in'
  | 'user.invited'
  | 'user.role_changed'
  | 'settings.changed'
  | 'billing.changed';

// ---- Core Entities ----

export interface Organization {
  id: string;
  clerk_org_id: string;
  name: string;
  nmls_company_id: string | null;
  licensed_states: string[];
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  clerk_user_id: string;
  org_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  nmls_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  org_id: string;
  assigned_to: string | null; // profile.id
  stage: LeadStage;

  // Borrower info
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null; // stored encrypted

  // TCPA / communication consent
  sms_consent: boolean;
  sms_consent_obtained_at: string | null;
  sms_consent_ip: string | null;
  sms_consent_text: string | null;
  unsubscribed_email: boolean;
  unsubscribed_at: string | null;

  // PII (stored encrypted in DB, decrypted only on server for authorized reads)
  ssn_encrypted: string | null;
  ssn_iv: string | null;
  income_encrypted: string | null;
  income_iv: string | null;
  credit_score: number | null; // encrypted in DB

  // Loan details
  loan_type: LoanType | null;
  loan_purpose: LoanPurpose | null;
  loan_amount: number | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_type: PropertyType | null;
  occupancy_type: OccupancyType | null;
  estimated_value: number | null;
  down_payment: number | null;
  ltv: number | null;

  // TRID compliance
  application_submitted_at: string | null;
  loan_estimate_sent_at: string | null;
  closing_disclosure_sent_at: string | null;
  closing_date: string | null;
  le_deadline: string | null; // calculated
  cd_deadline: string | null; // calculated

  // AI scoring
  ai_score: number | null; // 0–100
  ai_score_updated_at: string | null;
  pipeline_value: number | null; // weighted by stage probability

  // Source tracking
  lead_source: string | null;
  referral_partner_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;

  // Timestamps
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  org_id: string;
  author_id: string;
  content: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadTask {
  id: string;
  lead_id: string;
  org_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  org_id: string;
  actor_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Document {
  id: string;
  lead_id: string;
  org_id: string;
  uploaded_by: string;
  document_type: DocumentType;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string; // Supabase Storage path
  ai_extracted: boolean;
  ai_summary: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface Communication {
  id: string;
  lead_id: string;
  org_id: string;
  sender_id: string;
  channel: CommunicationChannel;
  direction: 'outbound' | 'inbound';
  subject: string | null;
  body: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  consent_status_at_send: boolean;
  resend_message_id: string | null;
  created_at: string;
}

// ---- Campaign Types ----

export interface Campaign {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  type: 'drip' | 'blast' | 'nurture';
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_stage: LeadStage | null;
  total_steps: number;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  org_id: string;
  step_number: number;
  channel: CommunicationChannel;
  delay_days: number;
  delay_hours: number;
  subject: string | null;
  body: string;
  active: boolean;
  created_at: string;
}

export interface CampaignEnrollment {
  id: string;
  campaign_id: string;
  lead_id: string;
  org_id: string;
  enrolled_at: string;
  current_step: number;
  status: 'active' | 'completed' | 'unsubscribed' | 'paused';
  next_send_at: string | null;
  completed_at: string | null;
}

// ---- Partner Types ----

export interface ReferralPartner {
  id: string;
  org_id: string;
  added_by: string;
  type: 'realtor' | 'builder' | 'cpa' | 'attorney' | 'financial_advisor' | 'other';
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  license_number: string | null;
  website: string | null;
  notes: string | null;
  referral_count: number;
  closed_count: number;
  total_volume: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Compliance Types ----

export interface TRIDStatus {
  le: TRIDStatusValue;
  cd: TRIDStatusValue;
  le_deadline: Date | null;
  cd_deadline: Date | null;
  le_days_remaining: number | null;
  cd_days_remaining: number | null;
}

export interface AuditEvent {
  id: string;
  org_id: string;
  actor_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PIIAccessLog {
  id: string;
  org_id: string;
  accessor_id: string;
  lead_id: string;
  fields_accessed: string[];
  purpose: string;
  ip_address: string | null;
  created_at: string;
}

// ---- Stripe / Billing ----

export interface SubscriptionPlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: number;
  stripePriceId: string;
  seats: number;
  features: string[];
}

// ---- API Response Types ----

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface APIError {
  code: string;
  message: string;
  field?: string;
}

// ---- Dashboard Types ----

export interface DashboardKPIs {
  totalLeads: number;
  pipelineValue: number;
  avgDaysToClose: number;
  speedToContact: number; // hours
  closedThisMonth: number;
  closedVolume: number;
  tridAlerts: number;
  conversionRate: number;
}

export interface PipelineSummary {
  stage: LeadStage;
  count: number;
  value: number;
}

// ---- Form / Validation Types ----

export interface LeadFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  loan_type?: LoanType;
  loan_purpose?: LoanPurpose;
  loan_amount?: number;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  property_type?: PropertyType;
  occupancy_type?: OccupancyType;
  estimated_value?: number;
  down_payment?: number;
  lead_source?: string;
  sms_consent?: boolean;
}

export interface OnboardingFormData {
  companyName: string;
  nmlsCompanyId: string;
  licensedStates: string[];
  plan: SubscriptionPlan;
}
