/**
 * Phase 50.1 — tenant channel config. Drives which features/compliance/pipeline
 * a tenant sees. organizations.channel selects one of these.
 */
export type TenantChannel = 'broker' | 'direct_lender' | 'correspondent' | 'bank_credit_union' | 'independent_lo';

export interface ChannelConfig {
  label: string;
  has_in_house_uw: boolean;
  compliance_layer: string;
  shows_wholesale_lenders: boolean;
  shows_correspondent: boolean;
  has_hmda_reporting?: boolean;
  investor_qa_required?: boolean;
  solo_mode?: boolean;
}

export const CHANNEL_CONFIG: Record<TenantChannel, ChannelConfig> = {
  broker: { label: 'Mortgage Broker', has_in_house_uw: false, compliance_layer: 'broker_trid', shows_wholesale_lenders: true, shows_correspondent: false },
  direct_lender: { label: 'Direct Lender', has_in_house_uw: true, compliance_layer: 'lender_trid', shows_wholesale_lenders: false, shows_correspondent: false, has_hmda_reporting: true },
  correspondent: { label: 'Correspondent Lender', has_in_house_uw: true, compliance_layer: 'correspondent', shows_wholesale_lenders: false, shows_correspondent: true, investor_qa_required: true, has_hmda_reporting: true },
  bank_credit_union: { label: 'Bank / Credit Union', has_in_house_uw: true, compliance_layer: 'bank_trid', shows_wholesale_lenders: false, shows_correspondent: false, has_hmda_reporting: true },
  independent_lo: { label: 'Independent LO', has_in_house_uw: false, compliance_layer: 'broker_trid', shows_wholesale_lenders: true, shows_correspondent: false, solo_mode: true },
};

export function channelConfig(channel?: string | null): ChannelConfig {
  return CHANNEL_CONFIG[(channel as TenantChannel) ?? 'broker'] ?? CHANNEL_CONFIG.broker;
}
