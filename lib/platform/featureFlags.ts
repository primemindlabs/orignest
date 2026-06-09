/**
 * Phase 51.1 — adaptive feature flags. Derived from organizations.channel +
 * profiles.role. Single source of truth for what a given user sees. Pure.
 */
import type { TenantChannel } from '@/lib/tenant/channelConfig';

export type FeatureKey =
  | 'pipeline_kanban' | 'leads_crm' | 'borrower_portal' | 'scenario_ai' | 'ask_ashley_chat'
  | 'trid_engine' | 'hmda_reporting' | 'tcpa_dialer' | 'realtor_discovery' | 'realtor_portal'
  | 'conditions_tab' | 'vendor_orders' | 'amc_integration' | 'submission_checklist' | 'uw_queue'
  | 'ae_book_of_business' | 'ae_department_head' | 'broker_onboarding' | 'rate_exception_workflow'
  | 'wholesale_ops_queue' | 'lock_desk' | 'branch_pnl' | 'lo_scorecards' | 'comp_plans'
  | 'license_manager' | 'marketing_compliance' | 'investor_qc' | 'delivery_tracking'
  | 'bank_stmt_analysis' | 'rent_roll_analysis' | 'morning_briefing' | 'pipeline_priority_queue';

export type FeatureSet = Record<FeatureKey, boolean>;

const ALL_OFF = (): FeatureSet => ({
  pipeline_kanban: false, leads_crm: false, borrower_portal: false, scenario_ai: false, ask_ashley_chat: false,
  trid_engine: false, hmda_reporting: false, tcpa_dialer: false, realtor_discovery: false, realtor_portal: false,
  conditions_tab: false, vendor_orders: false, amc_integration: false, submission_checklist: false, uw_queue: false,
  ae_book_of_business: false, ae_department_head: false, broker_onboarding: false, rate_exception_workflow: false,
  wholesale_ops_queue: false, lock_desk: false, branch_pnl: false, lo_scorecards: false, comp_plans: false,
  license_manager: false, marketing_compliance: false, investor_qc: false, delivery_tracking: false,
  bank_stmt_analysis: false, rent_roll_analysis: false, morning_briefing: false, pipeline_priority_queue: false,
});

function on(set: FeatureSet, keys: FeatureKey[]): FeatureSet { for (const k of keys) set[k] = true; return set; }

function channelBase(channel: TenantChannel): FeatureSet {
  const s = ALL_OFF();
  const common: FeatureKey[] = ['pipeline_kanban', 'leads_crm', 'borrower_portal', 'ask_ashley_chat', 'trid_engine', 'conditions_tab', 'morning_briefing', 'license_manager'];
  on(s, common);
  if (channel === 'broker' || channel === 'independent_lo') {
    on(s, ['scenario_ai', 'tcpa_dialer', 'realtor_discovery', 'realtor_portal', 'vendor_orders', 'amc_integration', 'submission_checklist', 'lo_scorecards', 'comp_plans', 'bank_stmt_analysis', 'rent_roll_analysis']);
    if (channel === 'broker') on(s, ['branch_pnl', 'marketing_compliance']);
  }
  if (channel === 'direct_lender' || channel === 'correspondent' || channel === 'bank_credit_union') {
    on(s, ['hmda_reporting', 'vendor_orders', 'amc_integration', 'submission_checklist', 'uw_queue', 'broker_onboarding', 'rate_exception_workflow', 'wholesale_ops_queue', 'lock_desk', 'branch_pnl', 'lo_scorecards', 'comp_plans', 'bank_stmt_analysis', 'rent_roll_analysis']);
    if (channel !== 'bank_credit_union') on(s, ['ae_book_of_business', 'ae_department_head']);
  }
  if (channel === 'correspondent') on(s, ['investor_qc', 'delivery_tracking']);
  return s;
}

// Roles that should NOT see borrower/marketing/rate features.
const ROLE_OFF: Partial<Record<string, FeatureKey[]>> = {
  loa: ['scenario_ai', 'branch_pnl', 'lo_scorecards', 'comp_plans', 'marketing_compliance'],
  processor: ['scenario_ai', 'leads_crm', 'realtor_discovery'],
  uw: ['scenario_ai', 'leads_crm', 'realtor_discovery'],
  brand_manager: ['pipeline_kanban', 'leads_crm'],
};
const ROLE_ON: Partial<Record<string, FeatureKey[]>> = {
  processor: ['pipeline_priority_queue'],
  uw: ['uw_queue', 'pipeline_priority_queue'],
  branch_manager: ['branch_pnl', 'lo_scorecards'],
  brand_manager: ['marketing_compliance'],
  ae: ['ae_book_of_business'],
  ae_manager: ['ae_book_of_business', 'ae_department_head'],
  wholesale_ops: ['wholesale_ops_queue'],
  lock_desk: ['lock_desk'],
};

export function deriveFeatureSet(channel: string | null | undefined, role: string | null | undefined): FeatureSet {
  const s = channelBase((channel as TenantChannel) ?? 'broker');
  if (role === 'admin') { for (const k of Object.keys(s) as FeatureKey[]) s[k] = true; return s; }
  for (const k of ROLE_OFF[role ?? ''] ?? []) s[k] = false;
  on(s, ROLE_ON[role ?? ''] ?? []);
  return s;
}

export function hasFeature(channel: string | null | undefined, role: string | null | undefined, key: FeatureKey): boolean {
  return deriveFeatureSet(channel, role)[key];
}
