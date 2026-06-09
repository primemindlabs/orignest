/**
 * Phase 28.3 — Smart adaptive field system.
 *
 * LoanContext is the single object the 1003 + underwriting forms read to decide
 * which fields show and what defaults apply. It is DERIVED from the real `leads`
 * row (whose vocabulary differs from the generic spec) so the rest of the system
 * can speak one consistent language.
 */

export type LoanProgram = 'FHA' | 'VA' | 'USDA' | 'Conventional' | 'Jumbo' | 'Non-QM';
export type EmploymentType = 'W2' | 'Self-Employed' | 'Retired' | '1099' | 'Military' | 'Other';
export type PropertyType = 'SFR' | 'Condo' | 'Multi-Family-2' | 'Multi-Family-3-4' | 'Manufactured' | 'PUD';
export type TransactionType = 'Purchase' | 'Rate-Term-Refi' | 'Cash-Out-Refi' | 'HELOC';
export type Occupancy = 'Primary' | 'Second-Home' | 'Investment';

export type LoanContext = {
  loan_program: LoanProgram;
  employment_type: EmploymentType;
  property_type: PropertyType;
  transaction_type: TransactionType;
  occupancy: Occupancy;
  has_co_borrower: boolean;
  has_reo: boolean;
  down_payment_pct: number;
  loan_amount: number;
  is_self_employed: boolean;
  is_military: boolean;
};

// ── Vocabulary maps: real leads.* values → LoanContext enums ─────────────────

const PROGRAM_MAP: Record<string, LoanProgram> = {
  conventional: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo',
  non_qm: 'Non-QM', dscr: 'Non-QM', heloc: 'Conventional', construction: 'Conventional',
  reverse: 'Conventional', commercial: 'Non-QM',
};

const TRANSACTION_MAP: Record<string, TransactionType> = {
  purchase: 'Purchase',
  rate_term_refinance: 'Rate-Term-Refi',
  cash_out_refinance: 'Cash-Out-Refi',
  heloc: 'HELOC',
  construction: 'Purchase',
};

const OCCUPANCY_MAP: Record<string, Occupancy> = {
  primary_residence: 'Primary', second_home: 'Second-Home', investment_property: 'Investment',
};

const PROPERTY_MAP: Record<string, PropertyType> = {
  single_family: 'SFR', condo: 'Condo', townhouse: 'PUD',
  multi_family_2_4: 'Multi-Family-2', multi_family_5plus: 'Multi-Family-3-4',
  manufactured: 'Manufactured', land: 'SFR', commercial: 'SFR',
};

export interface LeadLike {
  loan_type?: string | null;
  loan_purpose?: string | null;
  occupancy_type?: string | null;
  property_type?: string | null;
  loan_amount?: number | null;
  down_payment?: number | null;
  estimated_value?: number | null;
}

/** Optional 1003 application section data refines flags the lead row can't carry. */
export interface ApplicationLike {
  has_co_borrower?: boolean;
  has_reo?: boolean;
  employment_type?: string | null;
}

export function deriveLoanContext(lead: LeadLike, app?: ApplicationLike | null): LoanContext {
  const loan_program = PROGRAM_MAP[lead.loan_type ?? ''] ?? 'Conventional';
  const transaction_type = TRANSACTION_MAP[lead.loan_purpose ?? ''] ?? 'Purchase';
  const occupancy = OCCUPANCY_MAP[lead.occupancy_type ?? ''] ?? 'Primary';
  const property_type = PROPERTY_MAP[lead.property_type ?? ''] ?? 'SFR';

  const loan_amount = Number(lead.loan_amount ?? 0);
  const value = Number(lead.estimated_value ?? 0);
  const down = Number(lead.down_payment ?? 0);
  // Down-payment % from explicit down payment over (loan + down) when available.
  const basis = down + loan_amount;
  const down_payment_pct = down > 0 && basis > 0 ? Math.round((down / basis) * 1000) / 10 : value > 0 && loan_amount > 0 ? Math.max(0, Math.round((1 - loan_amount / value) * 1000) / 10) : 0;

  const emp = (app?.employment_type ?? '') as string;
  const employment_type: EmploymentType =
    emp === 'self_employed' ? 'Self-Employed'
    : emp === 'retired' ? 'Retired'
    : emp === '1099' ? '1099'
    : emp === 'w2' ? 'W2'
    : loan_program === 'VA' ? 'Military'
    : 'W2';

  return {
    loan_program,
    employment_type,
    property_type,
    transaction_type,
    occupancy,
    has_co_borrower: !!app?.has_co_borrower,
    has_reo: !!app?.has_reo,
    down_payment_pct,
    loan_amount,
    is_self_employed: employment_type === 'Self-Employed',
    is_military: loan_program === 'VA' || employment_type === 'Military',
  };
}
