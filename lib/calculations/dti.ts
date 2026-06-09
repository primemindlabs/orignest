/**
 * Phase 59.4 — DTI engine. PURE.
 * Front-end = PITI / gross monthly income. Back-end = (PITI + other debts) / gross.
 * Handles deferred-student-loan treatment + DTI-omit rules.
 */
import type { LiabilityEntry } from '@/types/application';

export interface PITI { principal_interest: number; taxes: number; insurance: number; hoa?: number; mip_pmi?: number }
export interface DTIResult {
  piti: number; total_debt: number; gross_monthly_income: number;
  front_end: number; back_end: number;
  front_tier: 'green' | 'amber' | 'red'; back_tier: 'green' | 'amber' | 'red';
}

/** Deferred/student-loan payment per selected method (falls back to actual). */
export function studentLoanPayment(l: LiabilityEntry): number {
  if (l.liability_type !== 'student_loan') return l.monthly_payment;
  switch (l.student_loan_calc_method) {
    case '1pct_of_balance': return l.unpaid_balance * 0.01;
    case '0.5pct_of_balance': return l.unpaid_balance * 0.005;
    case 'ibr_payment': return l.student_loan_calculated_payment ?? l.monthly_payment;
    default: return l.monthly_payment;
  }
}

export function liabilityMonthly(l: LiabilityEntry): number {
  if (l.omit_from_dti) return 0;
  const base = studentLoanPayment(l);
  return l.joint_with_coborrower && l.coborrower_responsible_pct != null ? base * (1 - l.coborrower_responsible_pct / 100) : base;
}

export function calculateDTI(piti: PITI, liabilities: LiabilityEntry[], grossMonthlyIncome: number, extra: { alimony?: number; child_support?: number } = {}): DTIResult {
  const pitiTotal = piti.principal_interest + piti.taxes + piti.insurance + (piti.hoa ?? 0) + (piti.mip_pmi ?? 0);
  const debts = (liabilities ?? []).reduce((s, l) => s + liabilityMonthly(l), 0) + (extra.alimony ?? 0) + (extra.child_support ?? 0);
  const total = pitiTotal + debts;
  const inc = grossMonthlyIncome > 0 ? grossMonthlyIncome : 1;
  const front = (pitiTotal / inc) * 100;
  const back = (total / inc) * 100;
  const tier = (v: number, lo: number, hi: number): 'green' | 'amber' | 'red' => (v <= lo ? 'green' : v <= hi ? 'amber' : 'red');
  return {
    piti: Math.round(pitiTotal), total_debt: Math.round(total), gross_monthly_income: Math.round(grossMonthlyIncome),
    front_end: Math.round(front * 10) / 10, back_end: Math.round(back * 10) / 10,
    front_tier: tier(front, 36, 50), back_tier: tier(back, 43, 50),
  };
}
