/**
 * Phase 138 — AI income extraction from an uploaded document (Claude, no Textract).
 * Accepts a paystub / W-2 / 1099 / bank statement / tax return (PDF or image) and
 * returns the figures the income calculators need + a monthly-income estimate.
 * Gated on ANTHROPIC_API_KEY; callers handle the not-configured case.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export type IncomeDocType = 'paystub' | 'w2' | '1099' | 'bank_statement' | 'tax_return' | 'unknown';

export interface IncomeExtraction {
  doc_type: IncomeDocType;
  /** Flat figures the calculators consume (keys vary by doc type). */
  fields: Record<string, number | string | null>;
  /** Best-estimate qualifying monthly income, if derivable. */
  monthly_income_estimate: number | null;
  /** Plain-language notes / caveats for the LO. */
  notes: string;
}

const MODEL = 'claude-sonnet-4-6';

const SYSTEM = `You are a mortgage income-document analyst. Extract income figures from the provided document for Fannie/Freddie qualifying-income worksheets.
Return ONLY minified JSON:
{"doc_type":"paystub|w2|1099|bank_statement|tax_return|unknown","fields":{...},"monthly_income_estimate":<number|null>,"notes":"<short>"}
Field guidance by doc_type:
- paystub: {"ytd_gross":n,"pay_period_gross":n,"pay_date":"YYYY-MM-DD","pay_frequency":"weekly|biweekly|semimonthly|monthly","employer":"..."}
- w2: {"box1_wages":n,"box3_ss_wages":n,"tax_year":n,"employer":"..."}
- 1099: {"nonemployee_comp":n,"tax_year":n,"payer":"..."}
- bank_statement: {"total_deposits":n,"statement_months":n,"avg_monthly_deposits":n}
- tax_return: {"schedule_c_net_profit":n,"depreciation":n,"business_use_of_home":n,"tax_year":n}
Use null for anything not present. monthly_income_estimate = your best qualifying monthly figure (e.g. paystub YTD/elapsed months, W-2 box1/12, bank deposits avg). Never invent numbers not supported by the document.`;

function stripFences(s: string): string {
  return s.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim();
}

export function isIncomeExtractionConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function extractIncomeFromDoc(
  base64: string,
  mediaType: string,
  hintType?: IncomeDocType,
): Promise<IncomeExtraction> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isPdf = mediaType === 'application/pdf';
  const docBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp', data: base64 } };

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          docBlock,
          { type: 'text', text: `Extract income figures.${hintType && hintType !== 'unknown' ? ` The user says this is a ${hintType}.` : ''}` },
        ],
      },
    ],
  });

  const block = msg.content.find((b) => b.type === 'text');
  const raw = block && block.type === 'text' ? block.text : '';
  try {
    const parsed = JSON.parse(stripFences(raw).match(/\{[\s\S]*\}/)?.[0] ?? stripFences(raw));
    return {
      doc_type: (parsed.doc_type as IncomeDocType) ?? 'unknown',
      fields: (parsed.fields as Record<string, number | string | null>) ?? {},
      monthly_income_estimate: typeof parsed.monthly_income_estimate === 'number' ? parsed.monthly_income_estimate : null,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch {
    return { doc_type: 'unknown', fields: {}, monthly_income_estimate: null, notes: 'Could not read this document automatically — enter the figures manually.' };
  }
}
