// Credit Repair Organizations Act (CROA) disclosure — snapshotted into the
// enrollment record at signing time for compliance. Brand + fee are env-driven
// for white-label; CREDIT_REPAIR_MONTHLY_FEE MUST be set to the actual billed amount.
const PLATFORM = process.env.PLATFORM_NAME ?? 'our platform';
const MONTHLY_FEE = process.env.CREDIT_REPAIR_MONTHLY_FEE ?? '$19.99';

export const CROA_DISCLOSURE = `CONSUMER CREDIT REPAIR ORGANIZATIONS ACT DISCLOSURE

You have a right to dispute inaccurate information in your credit report by contacting the credit bureau directly. There is no fee charged by credit bureaus for such disputes.

${PLATFORM} is a credit services organization. Before paying any money, you have the right to:
1. Review a copy of your rights under the Credit Repair Organizations Act (15 U.S.C. §1679 et seq.)
2. Cancel this contract within 3 business days without charge
3. Receive a complete description of services to be performed

${PLATFORM} will: (a) review your credit report for inaccurate, incomplete, or unverifiable items, (b) prepare and send dispute letters to the three major credit bureaus on your behalf, (c) track bureau responses and generate follow-up correspondence, and (d) provide you with progress updates throughout the credit repair process.

${PLATFORM} will not: (a) advise you to dispute accurate information, (b) make any guarantee regarding credit score improvement, (c) charge you before services are rendered.

Monthly fee: ${MONTHLY_FEE} billed after your free trial period. You may cancel at any time.

By signing below, you acknowledge receipt of this disclosure and agree to the terms of service.`;
