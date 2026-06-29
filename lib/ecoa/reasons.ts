/**
 * ECOA / Regulation B approved adverse-action reason codes. Plain module (no
 * server-only) so both the PDF builder and client UI can share the list.
 */
export const ECOA_DENIAL_REASONS = [
  'Credit application incomplete',
  'Insufficient number of credit references provided',
  'Unable to verify credit references',
  'Temporary or irregular employment',
  'Unable to verify employment',
  'Length of employment',
  'Insufficient income',
  'Excessive obligations in relation to income',
  'Unable to verify income',
  'Length of residence',
  'Temporary residence',
  'Unable to verify residence',
  'No credit file',
  'Limited credit experience',
  'Poor credit performance with us',
  'Delinquent past or present credit obligations with others',
  'Collection action or judgment',
  'Garnishment or attachment',
  'Foreclosure or repossession',
  'Bankruptcy',
  'Number of recent inquiries on credit bureau report',
  'Value or type of collateral not sufficient',
  'Unacceptable property',
  'Unable to appraise property',
  'Lack of cash reserves',
  'Excessive number of accounts',
  'Other — specify',
] as const;
