/**
 * Phase 18 — Smart 1003 conditional field rules.
 *
 * The 1003 has ~250 fields; most loans need 40–80. These rules drive which
 * field groups appear based on what the borrower/LO has entered, so the form
 * only ever asks what's relevant. Used by the `useConditionalForm` hook.
 */
export interface ConditionalRule {
  /** field key whose value is watched */
  trigger: string;
  /** value that activates the rule */
  value: string | boolean | number;
  /** field keys revealed when trigger === value */
  show: string[];
}

export const conditionalRules: ConditionalRule[] = [
  // Loan purpose
  { trigger: 'loan_purpose', value: 'purchase', show: ['purchase_contract_signed', 'purchase_price', 'listing_agent_name'] },
  { trigger: 'loan_purpose', value: 'rate_term_refinance', show: ['current_loan_balance', 'current_rate', 'reason_for_refinance'] },
  { trigger: 'loan_purpose', value: 'cash_out_refinance', show: ['current_loan_balance', 'requested_cash_out', 'cash_out_purpose'] },

  // Property / occupancy
  { trigger: 'occupancy_type', value: 'investment', show: ['rental_income_monthly', 'property_manager_name', 'lease_expiration_date', 'entity_name'] },
  { trigger: 'property_type', value: '2_4_unit', show: ['rental_income_per_unit', 'units_occupied', 'rental_income_monthly'] },

  // Loan type
  { trigger: 'loan_type', value: 'va', show: ['va_service_dates', 'va_certificate_type', 'va_disability_status', 'va_funding_fee_exempt'] },
  { trigger: 'loan_type', value: 'fha', show: ['fha_case_number', 'fha_connection_id', 'energy_efficient_mortgage'] },
  { trigger: 'loan_type', value: 'dscr', show: ['dscr_entity_name', 'dscr_entity_type', 'rental_income_verified', 'dscr_no_income_verification'] },

  // Employment
  { trigger: 'employment_type', value: 'self_employed', show: ['business_name', 'business_start_date', 'business_ownership_percentage', 'business_type', 'years_self_employed'] },
  { trigger: 'employment_type', value: 'retired', show: ['retirement_income_source', 'pension_start_date', 'ss_income_monthly'] },

  // Citizenship
  { trigger: 'citizenship', value: 'non_permanent_resident', show: ['visa_type', 'visa_expiration', 'employment_authorization_card'] },

  // Co-borrower
  { trigger: 'has_co_borrower', value: true, show: ['co_borrower_section'] },

  // Credit events
  { trigger: 'has_bankruptcy', value: true, show: ['bankruptcy_type', 'bankruptcy_discharge_date', 'bankruptcy_dismissal_date'] },
  { trigger: 'has_foreclosure', value: true, show: ['foreclosure_date', 'foreclosure_property_address'] },
];
