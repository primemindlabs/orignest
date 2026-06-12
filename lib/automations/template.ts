// Phase 107 — milestone automation template variables + renderer. PURE.
//
// PII SAFETY — only the variables below are ever resolvable. NEVER add:
//   {{borrower_last_name}} (last name is PII; first name only in outbound),
//   {{ssn}} / {{income}} / {{loan_amount}} (financial PII),
//   {{rate}} / {{apr}} (rate quotes trigger Reg Z disclosures).

export interface TemplateContext {
  borrower_first_name: string;
  loan_type: string;
  portal_token: string;
  realtor_name: string;
  lo_name: string;
  lo_phone: string;
  lo_nmls: string;
  current_stage: string;
  days_in_stage: number;
  baseUrl: string;
}

export const TEMPLATE_VARIABLES: Record<string, (ctx: TemplateContext) => string> = {
  '{{borrower_first_name}}': (c) => c.borrower_first_name || 'there',
  '{{loan_type}}': (c) => c.loan_type || 'your mortgage',
  '{{portal_link}}': (c) => (c.portal_token ? `${c.baseUrl}/b/${c.portal_token}` : c.baseUrl),
  '{{realtor_name}}': (c) => c.realtor_name || 'your agent',
  '{{lo_name}}': (c) => c.lo_name,
  '{{lo_phone}}': (c) => c.lo_phone || '',
  '{{lo_nmls}}': (c) => c.lo_nmls || '',
  '{{current_stage}}': (c) => formatStageName(c.current_stage),
  '{{days_in_stage}}': (c) => String(c.days_in_stage ?? 0),
};

export const ALLOWED_TEMPLATE_VARIABLES = Object.keys(TEMPLATE_VARIABLES);

export function renderTemplate(template: string, ctx: TemplateContext): string {
  let rendered = template;
  for (const [variable, resolver] of Object.entries(TEMPLATE_VARIABLES)) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rendered = rendered.replace(new RegExp(escaped, 'g'), resolver(ctx));
  }
  return rendered;
}

export function formatStageName(stage: string | null): string {
  if (!stage) return 'your loan';
  return stage
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
