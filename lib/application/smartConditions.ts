/**
 * Phase 59.2 — smart conditional logic engine. PURE. Given a (partial) URLA, surface
 * blocking/warning/info conditions: employment history, self-employment, variable
 * income, large deposits, bankruptcy/foreclosure waiting periods, DTI thresholds,
 * community-property states, deferred student loans.
 */
import type { LoanApplication } from '@/types/application';

export interface ApplicationCondition { trigger: string; severity: 'blocking' | 'warning' | 'info'; section: string; message: string; action?: string; loe_required?: boolean; doc_required?: string }

const COMMUNITY_PROPERTY = new Set(['AZ', 'CA', 'ID', 'LA', 'NV', 'NM', 'TX', 'WA', 'WI']);
const monthsDiff = (from: string) => { const d = new Date(from); return isNaN(d.getTime()) ? 0 : Math.floor((Date.now() - d.getTime()) / (30.44 * 86_400_000)); };
const yearsDiff = (from: string) => monthsDiff(from) / 12;

export function evaluateConditions(app: Partial<LoanApplication>): ApplicationCondition[] {
  const out: ApplicationCondition[] = [];
  const emp = app.income_data?.primary_employer;

  if (emp?.start_date) {
    const m = monthsDiff(emp.start_date);
    if (m < 24 && (app.income_data?.additional_employers?.length ?? 0) === 0) {
      out.push({ trigger: 'employment_under_2yr', severity: 'blocking', section: 'employment', message: `Current employment is ${m} months. Previous employer history is required to complete a 2-year history.`, action: 'Add previous employer' });
    }
    if (emp.is_self_employed && m < 24) {
      out.push({ trigger: 'self_employed_under_2yr', severity: 'blocking', section: 'employment', message: 'Self-employment must be verified for 2 years. 2 years of personal + business tax returns required.', doc_required: '2yr_tax_returns_self_employed' });
    }
    const variable = (emp.commission_monthly ?? 0) + (emp.bonus_monthly ?? 0) + (emp.overtime_monthly ?? 0);
    const total = (emp.base_monthly ?? 0) + variable;
    if (total > 0 && variable / total > 0.25) {
      out.push({ trigger: 'variable_income_over_25pct', severity: 'warning', section: 'income', message: `Variable income is ${Math.round((variable / total) * 100)}% of total — a 2-year average will be used for qualifying.` });
    }
  }

  const income = app.income_data?.total_qualifying_income_monthly ?? 0;
  for (const a of app.assets_data?.assets ?? []) {
    for (const dep of a.large_deposits ?? []) {
      if (income > 0 && dep.amount > income * 0.5 && !dep.explanation_provided) {
        out.push({ trigger: `large_deposit_${dep.deposit_date}`, severity: 'blocking', section: 'assets', message: `Large deposit of $${dep.amount.toLocaleString()} on ${dep.deposit_date} exceeds 50% of monthly income. LOE + sourcing required.`, loe_required: true });
      }
    }
  }

  const d = app.declarations_data;
  if (d?.declared_bankruptcy_7yr && d.bankruptcy_discharge_date) {
    const y = yearsDiff(d.bankruptcy_discharge_date);
    const periods = d.bankruptcy_chapter === 13 ? [{ y: 2, p: 'Conventional' }, { y: 1, p: 'FHA/VA (from filing, trustee approval)' }] : [{ y: 4, p: 'Conventional' }, { y: 2, p: 'FHA' }, { y: 2, p: 'VA' }];
    for (const per of periods) if (y < per.y) out.push({ trigger: `bankruptcy_waiting_${per.p}`, severity: 'warning', section: 'declarations', message: `Chapter ${d.bankruptcy_chapter} discharged ${y.toFixed(1)}y ago. ${per.p} requires a ${per.y}-year wait.` });
  }
  if (d?.property_foreclosed_7yr && d.foreclosure_completion_date) {
    const y = yearsDiff(d.foreclosure_completion_date);
    if (y < 7) out.push({ trigger: 'foreclosure_waiting_period', severity: y < 3 ? 'blocking' : 'warning', section: 'declarations', message: `Foreclosure completed ${y.toFixed(1)}y ago. FHA requires 3y; conventional 7y (3y with extenuating circumstances).` });
  }

  const back = app.liabilities_data?.back_end_dti;
  if (back != null) {
    if (back > 57) out.push({ trigger: 'dti_exceeds_57pct', severity: 'blocking', section: 'liabilities', message: `Back-end DTI ${back.toFixed(1)}% exceeds the FHA maximum of 57%.` });
    else if (back > 50) out.push({ trigger: 'dti_exceeds_50pct', severity: 'warning', section: 'liabilities', message: `Back-end DTI ${back.toFixed(1)}% requires compensating factors for conventional approval.` });
    else if (back > 43) out.push({ trigger: 'dti_exceeds_43pct', severity: 'info', section: 'liabilities', message: `DTI ${back.toFixed(1)}% is above the 43% QM threshold — manual underwrite may be required.` });
  }

  const state = app.loan_property_data?.subject_property_address?.split(',').map((s) => s.trim()).find((s) => COMMUNITY_PROPERTY.has(s.toUpperCase()));
  if (state && app.borrower_data?.marital_status === 'married' && !app.coborrower_data) {
    out.push({ trigger: 'community_property_state_married', severity: 'warning', section: 'borrower', message: `Property is in ${state.toUpperCase()}, a community-property state. A non-borrowing spouse's debts may count in DTI — confirm with underwriting.` });
  }

  for (const l of app.liabilities_data?.liabilities ?? []) {
    if (l.liability_type === 'student_loan' && l.is_deferred && !l.student_loan_calc_method) {
      out.push({ trigger: `student_loan_deferred_${l.account_last4 ?? l.creditor_name}`, severity: 'blocking', section: 'liabilities', message: `Deferred student loan (${l.creditor_name}) needs a treatment method: 1% of balance, 0.5%, or verified IBR payment.`, action: 'Select calculation method' });
    }
  }
  return out;
}

export function completenessFromConditions(conditions: ApplicationCondition[]): { blocking: number; ready: boolean } {
  const blocking = conditions.filter((c) => c.severity === 'blocking').length;
  return { blocking, ready: blocking === 0 };
}
