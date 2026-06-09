/**
 * Phase 44.3 — Scenario AI reasoning layer (Claude Sonnet). Given a borrower
 * scenario + the LO's preferred lender matrix, identify which lenders can close
 * the deal and why. Sonnet (not Haiku) for this reasoning task.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export interface ScenarioInputs {
  fico_score?: number; co_borrower_fico?: number;
  income_type?: string; monthly_income?: number; dti?: number; reserves_months?: number;
  loan_type?: string; purpose?: string; loan_amount?: number; property_value?: number; ltv?: number;
  property_type?: string; is_non_warrantable?: boolean;
  dscr_ratio?: number; monthly_rent?: number;
  bank_stmt_months?: number; bank_stmt_income?: number; income_1099_annual?: number;
  has_bk_history?: boolean; bk_discharge_months?: number; has_foreclosure?: boolean; foreclosure_months?: number;
  occupancy?: string; state?: string;
}

export interface PreferredLender {
  id: string; lender_name: string; lender_type: string;
  ae_name?: string | null; ae_email?: string | null; ae_phone?: string | null;
  loan_types: string[]; min_fico?: number | null; max_ltv?: number | null;
  min_loan_amt?: number | null; max_loan_amt?: number | null; notes?: string | null;
  overlay_notes?: Record<string, unknown> | null; is_active: boolean;
}

export interface ScenarioResult {
  analysis_text: string;
  matched_lenders: PreferredLender[];
  general_recommendation: string;
}

function lenderBlock(l: PreferredLender): string {
  return `**${l.lender_name}** (${l.lender_type})
- AE: ${l.ae_name ?? 'Not set'}${l.ae_phone ? ` · ${l.ae_phone}` : ''}
- Loan types: ${l.loan_types.join(', ') || 'unspecified'}
- Min FICO: ${l.min_fico ?? 'n/a'} · Max LTV: ${l.max_ltv ? `${(l.max_ltv * 100).toFixed(0)}%` : 'n/a'}
- Loan range: ${l.min_loan_amt ? `$${(l.min_loan_amt / 1000).toFixed(0)}K` : 'no min'} – ${l.max_loan_amt ? `$${(l.max_loan_amt / 1000).toFixed(0)}K` : 'no max'}
- Overlays: ${JSON.stringify(l.overlay_notes ?? {})}
- LO notes: ${l.notes ?? 'None'}`;
}

export function buildSystemPrompt(lenders: PreferredLender[], ctx: { company_name: string; state_licenses: string[]; custom_prompt?: string | null }): string {
  const active = lenders.filter((l) => l.is_active);
  return `You are a senior mortgage scenario analyst at ${ctx.company_name}. Analyze a loan scenario and identify which lenders can close this deal and why.

## Lender Matrix
${active.length ? active.map(lenderBlock).join('\n\n') : 'No preferred lenders configured yet. Provide general guidance only.'}
${ctx.custom_prompt ? `\n## Broker context\n${ctx.custom_prompt}` : ''}
${ctx.state_licenses?.length ? `\n## Licensed states: ${ctx.state_licenses.join(', ')}` : ''}

## Instructions
1. Identify which lenders from the matrix are most likely to approve this deal.
2. For each recommended lender, cite the specific overlay/minimum/program that makes them a fit.
3. Flag guideline risks clearly (e.g. "FICO 629 — most DSCR lenders want 640+").
4. Suggest restructuring if it unlocks options (lower LTV, raise DSCR, more reserves).
5. If no configured lender fits, recommend lender TYPES to approach.
6. Be specific and actionable — the LO should be able to pick up the phone after reading.
7. Under 400 words, bullet points preferred.
8. Do NOT invent lender names not in the matrix. For general market knowledge, prefix "Generally speaking:".`;
}

const INCOME_LABEL: Record<string, string> = { w2: 'W-2', self_employed_bank_stmt: 'Self-employed (bank statement)', self_employed_1099: '1099', dscr: 'DSCR (rental income)', asset_depletion: 'Asset depletion', itin: 'ITIN' };

export function buildUserPrompt(i: ScenarioInputs): string {
  const L: string[] = ['Analyze this loan scenario:', '', '**Borrower**'];
  if (i.fico_score) L.push(`- FICO: ${i.fico_score}${i.co_borrower_fico ? ` / co-borrower ${i.co_borrower_fico}` : ''}`);
  if (i.income_type) L.push(`- Income type: ${INCOME_LABEL[i.income_type] ?? i.income_type}`);
  if (i.monthly_income) L.push(`- Qualifying income: $${i.monthly_income.toLocaleString()}/mo`);
  if (i.dti) L.push(`- DTI: ${i.dti}%`);
  if (i.reserves_months) L.push(`- Reserves: ${i.reserves_months} months`);
  if (i.has_bk_history) L.push(`- BK: ${i.bk_discharge_months ?? '?'} months since discharge`);
  if (i.has_foreclosure) L.push(`- Foreclosure: ${i.foreclosure_months ?? '?'} months ago`);
  L.push('', '**Loan**');
  if (i.loan_type) L.push(`- Type: ${i.loan_type}${i.purpose ? ` · ${i.purpose}` : ''}`);
  if (i.loan_amount) L.push(`- Amount: $${i.loan_amount.toLocaleString()}`);
  if (i.property_value) L.push(`- Property value: $${i.property_value.toLocaleString()}`);
  if (i.ltv) L.push(`- LTV: ${(i.ltv * 100).toFixed(1)}%`);
  if (i.property_type) L.push(`- Property type: ${i.property_type}`);
  if (i.occupancy) L.push(`- Occupancy: ${i.occupancy}`);
  if (i.state) L.push(`- State: ${i.state}`);
  if (i.is_non_warrantable) L.push('- ⚠️ NON-WARRANTABLE CONDO');
  if (i.dscr_ratio) L.push('', `**DSCR**`, `- Ratio: ${i.dscr_ratio.toFixed(2)}${i.monthly_rent ? ` · rent $${i.monthly_rent.toLocaleString()}/mo` : ''}`);
  if (i.bank_stmt_income) L.push('', `**Bank statement income**`, `- Qualifying: $${i.bank_stmt_income.toLocaleString()}/mo`);
  L.push('', 'Who can do this deal?');
  return L.join('\n');
}

export async function analyzeScenario(inputs: ScenarioInputs, lenders: PreferredLender[], ctx: { company_name: string; state_licenses: string[]; custom_prompt?: string | null }): Promise<ScenarioResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: buildSystemPrompt(lenders, ctx),
    messages: [{ role: 'user', content: buildUserPrompt(inputs) }],
  });
  const content = message.content[0];
  const text = content.type === 'text' ? content.text : '';

  // Match lenders the analysis actually named (case-insensitive).
  const lower = text.toLowerCase();
  const matched = lenders.filter((l) => l.is_active && l.lender_name && lower.includes(l.lender_name.toLowerCase()));

  return { analysis_text: text, matched_lenders: matched, general_recommendation: matched.length ? '' : 'No configured lender is a clear fit — consider the lender types named in the analysis.' };
}
