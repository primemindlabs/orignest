/**
 * Phase 59 — Uniform Residential Loan Application (URLA / Fannie 1003 / Freddie 65)
 * TypeScript model. SSN and DOB are NEVER part of these types — they live only in
 * encrypted columns handled outside the application JSON.
 */

// ── Section 1: Borrower ─────────────────────────────────────────────────────
export interface BorrowerData {
  first_name: string; middle_name?: string; last_name: string; suffix?: string;
  alternate_names?: string[]; email: string; phone_cell: string; phone_home?: string; phone_work?: string;
  citizenship: 'us_citizen' | 'permanent_resident' | 'non_permanent_resident';
  marital_status: 'married' | 'separated' | 'unmarried';
  number_of_dependents: number; dependent_ages?: number[];
}

// ── Section 2: Residency ────────────────────────────────────────────────────
export interface ResidencyEntry {
  address: string; unit?: string; city: string; state: string; zip: string; country: string;
  from_date: string; to_date?: string; housing_status: 'own' | 'rent' | 'rent_free' | 'other';
  monthly_rent?: number; is_current: boolean;
}

// ── Section 3: Employment / Income ──────────────────────────────────────────
export interface EmployerEntry {
  employer_name: string; employer_address?: string; employer_city?: string; employer_state?: string; employer_zip?: string; employer_phone?: string;
  position_title: string; start_date: string; end_date?: string; is_current: boolean; is_self_employed: boolean;
  business_name?: string; business_type?: 'sole_proprietor' | 'partnership' | 's_corp' | 'c_corp' | 'llc'; ownership_pct?: number; years_self_employed?: number;
  base_monthly: number; overtime_monthly: number; bonus_monthly: number; commission_monthly: number; other_monthly: number; other_income_description?: string; military_income_monthly?: number;
  employment_in_related_field?: boolean;
}
export interface OtherIncomeSource {
  source_type: 'social_security' | 'disability' | 'pension' | 'annuity' | 'alimony_received' | 'child_support_received' | 'rental_other_properties' | 'trust' | 'notes_receivable' | 'interest_dividends' | 'other';
  monthly_amount: number; description?: string; continuance_verified: boolean; award_letter_obtained?: boolean;
}
export interface IncomeData {
  primary_employer: EmployerEntry; additional_employers: EmployerEntry[]; other_income_sources: OtherIncomeSource[];
  total_qualifying_income_monthly: number; income_requires_averaging?: boolean;
  self_employed_income_type?: 'schedule_c' | 'k1_partnership' | 'k1_s_corp' | 'k1_corp';
}

// ── Section 4: Assets ───────────────────────────────────────────────────────
export interface LargeDepositFlag { amount: number; deposit_date: string; explanation_provided: boolean; loe_id?: string }
export interface AssetEntry {
  account_type: 'checking' | 'savings' | 'money_market' | 'cd' | 'brokerage' | '401k' | 'ira' | 'roth_ira' | 'pension' | 'gift' | 'sale_of_property' | 'crypto_converted' | 'other';
  institution_name: string; account_last4?: string; current_balance: number; qualifying_balance: number;
  is_gift: boolean; gift_letter_obtained?: boolean; gift_donor_relationship?: 'parent' | 'sibling' | 'relative' | 'employer' | 'other'; gift_funds_deposited?: boolean;
  large_deposits?: LargeDepositFlag[]; statements_required_months?: number;
}
export interface AssetsData {
  assets: AssetEntry[]; total_liquid_assets: number; total_qualifying_assets: number; gift_total: number; reserves_months_piti?: number;
  down_payment_amount: number; down_payment_source: string; closing_costs_amount?: number; seller_concession_amount?: number;
}

// ── Section 5: Liabilities ──────────────────────────────────────────────────
export interface LiabilityEntry {
  creditor_name: string; account_last4?: string; monthly_payment: number; unpaid_balance: number; months_remaining?: number;
  liability_type: 'revolving' | 'installment' | 'student_loan' | 'auto' | 'mortgage_other_prop' | 'heloc' | 'lease' | 'alimony' | 'child_support' | 'judgments' | 'other';
  omit_from_dti: boolean; omit_reason?: '10_months_or_fewer' | 'business_debt_deducted' | 'paid_by_other' | 'other'; omit_notes?: string;
  is_deferred: boolean; deferred_end_date?: string; student_loan_calc_method?: 'actual' | '1pct_of_balance' | '0.5pct_of_balance' | 'ibr_payment'; student_loan_calculated_payment?: number;
  joint_with_coborrower?: boolean; coborrower_responsible_pct?: number;
}
export interface LiabilitiesData {
  liabilities: LiabilityEntry[]; alimony_monthly_payment?: number; child_support_monthly_payment?: number;
  total_monthly_debt: number; front_end_dti?: number; back_end_dti?: number;
}

// ── Section 6: Real Estate Owned ────────────────────────────────────────────
export interface RealEstateOwned {
  property_address: string; property_type: 'sfr' | 'condo' | 'townhouse' | '2_unit' | '3_unit' | '4_unit' | 'other';
  current_market_value: number; current_mortgage_balance: number; monthly_mortgage_payment: number;
  monthly_gross_rental_income: number; monthly_net_rental_income: number;
  property_status: 'retain' | 'pending_sale' | 'sold_at_closing'; is_subject_property: boolean; listed_for_sale: boolean; listing_price?: number;
}
export interface RealEstateData { properties: RealEstateOwned[]; total_equity: number }

// ── Section 7: Loan & Property ──────────────────────────────────────────────
export interface LoanPropertyData {
  subject_property_address: string; subject_property_type?: string; subject_property_usage: 'primary' | 'second_home' | 'investment';
  number_of_units: number; estate_will_be_held?: 'fee_simple' | 'leasehold';
  loan_purpose: 'purchase' | 'refinance_rate_term' | 'refinance_cashout' | 'construction';
  loan_amount: number; interest_rate?: number; loan_term_months: number;
  amortization_type: 'fixed' | 'arm' | 'interest_only' | 'graduated_payment' | 'balloon';
  rate_lock_preference?: 'lock_now' | 'float' | 'undecided';
}

// ── Section 8: Declarations ─────────────────────────────────────────────────
export interface DeclarationsData {
  intend_to_occupy_as_primary?: boolean; ownership_interest_past_3yr?: boolean; borrowing_down_payment?: boolean;
  outstanding_judgments?: boolean; declared_bankruptcy_7yr?: boolean; bankruptcy_chapter?: 7 | 11 | 12 | 13; bankruptcy_discharge_date?: string;
  property_foreclosed_7yr?: boolean; foreclosure_completion_date?: string; deed_in_lieu_7yr?: boolean;
  party_to_lawsuit?: boolean; delinquent_federal_debt?: boolean; obligated_alimony_child_support?: boolean; alimony_child_support_monthly?: number;
}

// ── Section 9: Military ─────────────────────────────────────────────────────
export interface MilitaryData {
  has_military_service: boolean; is_active_duty?: boolean; is_veteran?: boolean; is_surviving_spouse?: boolean;
  va_first_time_use?: boolean; va_funding_fee_exempt?: boolean; va_disability_rating_pct?: number;
}

// ── Section 10: Demographics (HMDA) ─────────────────────────────────────────
export interface DemographicData {
  ethnicity: 'hispanic_or_latino' | 'not_hispanic_or_latino' | 'information_not_provided' | 'not_applicable';
  races: ('american_indian_alaska_native' | 'asian' | 'black_african_american' | 'native_hawaiian_pacific_islander' | 'white' | 'information_not_provided' | 'not_applicable')[];
  sex: 'male' | 'female' | 'information_not_provided' | 'not_applicable';
  collection_method?: 'face_to_face' | 'telephone' | 'fax_or_mail' | 'internet';
}

// ── Full Application ────────────────────────────────────────────────────────
export interface LoanApplication {
  loan_id: string;
  borrower_data: Partial<BorrowerData>; coborrower_data?: Partial<BorrowerData>;
  residency_history?: ResidencyEntry[]; income_data?: Partial<IncomeData>; assets_data?: Partial<AssetsData>;
  liabilities_data?: Partial<LiabilitiesData>; real_estate_data?: Partial<RealEstateData>; loan_property_data?: Partial<LoanPropertyData>;
  declarations_data?: Partial<DeclarationsData>; military_data?: Partial<MilitaryData>; demographic_data?: Partial<DemographicData>;
  completeness_score?: number; last_saved_at?: string; ready_to_submit?: boolean;
}
