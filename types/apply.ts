// Phase 105 — Smart 1003 Digital Application types + conditional logic (PURE).
// NOTE: lives in types/apply.ts (types/application.ts is a pre-existing, unrelated
// 1003 file-data model — not clobbered).

export type ApplicationStatus = 'draft' | 'in_progress' | 'submitted' | 'reviewed';
export type EmploymentType = 'employed' | 'self_employed' | 'retired' | 'other';
export type LoanPurpose = 'purchase' | 'refinance' | 'cash_out';
export type PropertyType = 'primary' | 'investment' | 'second_home';

export const APPLICATION_SECTIONS = [
  'personal',
  'employment',
  'property',
  'loan',
  'assets',
  'hmda',
  'declarations',
  'review',
] as const;
export type ApplicationSection = (typeof APPLICATION_SECTIONS)[number];

export const SECTION_LABELS: Record<ApplicationSection, string> = {
  personal: 'Personal Info',
  employment: 'Employment',
  property: 'Property',
  loan: 'Loan Details',
  assets: 'Assets & Debts',
  hmda: 'Demographics',
  declarations: 'Declarations',
  review: 'Review & Submit',
};

export interface Application {
  id: string;
  lead_id: string;
  token: string;
  status: ApplicationStatus;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_dob: string | null;
  borrower_ssn_last4: string | null;
  borrower_phone: string | null;
  borrower_email: string | null;
  sms_consent: boolean;
  co_borrower: boolean;
  coborrower_first_name: string | null;
  coborrower_last_name: string | null;
  coborrower_dob: string | null;
  coborrower_phone: string | null;
  coborrower_email: string | null;
  employment_type: EmploymentType | null;
  employer_name: string | null;
  job_title: string | null;
  years_at_job: number | null;
  gross_monthly_income: number | null;
  self_emp_business_name: string | null;
  self_emp_years: number | null;
  self_emp_monthly_net: number | null;
  monthly_retirement_income: number | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_type: PropertyType | null;
  purchase_price: number | null;
  estimated_value: number | null;
  loan_purpose: LoanPurpose | null;
  desired_loan_amount: number | null;
  loan_type_preference: string | null;
  down_payment_amount: number | null;
  down_payment_source: string | null;
  checking_balance: number | null;
  savings_balance: number | null;
  retirement_balance: number | null;
  other_assets: number | null;
  monthly_debts: number | null;
  hmda_race: string | null;
  hmda_ethnicity: string | null;
  hmda_sex: string | null;
  declaration_bankruptcy: boolean | null;
  declaration_foreclosure: boolean | null;
  declaration_lawsuit: boolean | null;
  declaration_delinquent: boolean | null;
  declaration_alimony: boolean | null;
  declaration_borrowed_down: boolean | null;
  declaration_us_citizen: boolean | null;
  declaration_primary_res: boolean | null;
  created_at: string;
  submitted_at: string | null;
}

export interface SectionProgress {
  application_id: string;
  section_name: ApplicationSection;
  completed: boolean;
  completed_at: string | null;
}

/** Whether a given field is required, given the answers so far. */
export function isFieldRequired(field: string, app: Partial<Application>): boolean {
  if (field === 'employer_name' || field === 'job_title' || field === 'years_at_job') {
    return app.employment_type === 'employed';
  }
  if (field.startsWith('self_emp_')) return app.employment_type === 'self_employed';
  if (field === 'monthly_retirement_income') return app.employment_type === 'retired';
  if (field === 'purchase_price' || field === 'down_payment_amount') return app.loan_purpose === 'purchase';
  if (field === 'estimated_value') return app.loan_purpose === 'refinance' || app.loan_purpose === 'cash_out';
  if (field.startsWith('coborrower_')) return !!app.co_borrower;
  return true;
}

export function computeCompletionPct(app: Partial<Application>): number {
  const requiredFields: (keyof Application)[] = [
    'borrower_first_name', 'borrower_last_name', 'borrower_dob', 'borrower_phone',
    'employment_type', 'gross_monthly_income',
    'property_city', 'property_state', 'property_type',
    'loan_purpose', 'desired_loan_amount',
    'checking_balance', 'savings_balance', 'monthly_debts',
  ];
  const filled = requiredFields.filter((f) => app[f] != null && (app[f] as unknown) !== '').length;
  return Math.round((filled / requiredFields.length) * 100);
}

/** Fields each section may autosave (server-side allowlist). */
export const SECTION_FIELDS: Record<ApplicationSection, string[]> = {
  personal: ['borrower_first_name', 'borrower_last_name', 'borrower_dob', 'borrower_ssn_last4',
    'borrower_phone', 'borrower_email', 'sms_consent', 'co_borrower',
    'coborrower_first_name', 'coborrower_last_name', 'coborrower_dob',
    'coborrower_phone', 'coborrower_email'],
  employment: ['employment_type', 'employer_name', 'job_title', 'years_at_job',
    'gross_monthly_income', 'self_emp_business_name', 'self_emp_years',
    'self_emp_monthly_net', 'monthly_retirement_income'],
  property: ['property_address', 'property_city', 'property_state', 'property_zip',
    'property_type', 'loan_purpose', 'purchase_price', 'estimated_value'],
  loan: ['desired_loan_amount', 'loan_type_preference', 'down_payment_amount', 'down_payment_source'],
  assets: ['checking_balance', 'savings_balance', 'retirement_balance', 'other_assets', 'monthly_debts'],
  hmda: ['hmda_race', 'hmda_ethnicity', 'hmda_sex', 'hmda_collected_at'],
  declarations: ['declaration_bankruptcy', 'declaration_foreclosure', 'declaration_lawsuit',
    'declaration_delinquent', 'declaration_alimony', 'declaration_borrowed_down',
    'declaration_us_citizen', 'declaration_primary_res'],
  review: [],
};
