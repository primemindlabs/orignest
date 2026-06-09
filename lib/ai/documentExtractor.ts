/**
 * Phase 30.3 — Document Auto-Population (server-only).
 *
 * extractDocumentData() = Textract (gated) -> Claude interpretation.
 * interpretWithClaude() is real and runs on any OCR'd text once available.
 *
 * SECURITY: prompts request ssn_last4 / account_last4 ONLY. sanitizeExtraction()
 * additionally strips any full SSN / full account number that slips through, so
 * a full identifier can never reach the database.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { runTextract } from '@/lib/ai/textract';

const MODEL = 'claude-sonnet-4-5';

export type DocumentType = 'paystub' | 'w2' | 'bank_statement' | '1099' | 'tax_return' | 'unknown';

export interface DocumentExtraction {
  fields: Record<string, unknown>;
  confidence: number;
}

const PROMPTS: Record<DocumentType, string> = {
  paystub: `Extract from this pay stub. Return JSON:
{ "borrower_name": string, "employer_name": string, "employer_address": string|null,
  "pay_period_end": "YYYY-MM-DD", "pay_frequency": "weekly|biweekly|semimonthly|monthly",
  "gross_this_period": number, "gross_ytd": number, "base_pay_rate": number|null,
  "overtime_ytd": number|null, "bonus_ytd": number|null, "confidence": 0.0-1.0 }`,
  w2: `Extract from this W-2. Return JSON:
{ "borrower_name": string, "ssn_last4": string, "employer_name": string,
  "employer_ein": string|null, "tax_year": number, "box1_wages": number,
  "confidence": 0.0-1.0 }
NEVER return a full SSN — only the last 4 digits in ssn_last4.`,
  bank_statement: `Extract from this bank statement. Return JSON:
{ "account_holder": string, "bank_name": string, "account_type": "checking|savings|unknown",
  "account_last4": string, "statement_period_end": "YYYY-MM-DD", "ending_balance": number,
  "average_balance_2mo": number|null, "large_deposits": [{ "date": "YYYY-MM-DD", "amount": number }],
  "confidence": 0.0-1.0 }
NEVER return a full account number — only the last 4 digits in account_last4.`,
  '1099': `Extract from this 1099. Return JSON:
{ "recipient_name": string, "payer_name": string, "tax_year": number,
  "form_type": "1099-NEC|1099-MISC|1099-K|1099-R|other", "box1_amount": number, "confidence": 0.0-1.0 }`,
  tax_return: `Extract from this tax return (1040/1040-SR). Return JSON:
{ "filer_name": string, "tax_year": number, "filing_status": string, "agi": number,
  "total_income": number, "schedule_c_net": number|null, "schedule_e_net": number|null,
  "w2_wages": number|null, "confidence": 0.0-1.0 }`,
  unknown: `Identify this document type and extract the most relevant financial fields. Return JSON:
{ "document_type": string, "fields": object, "confidence": 0.0-1.0 }
NEVER include a full SSN or full account number — last 4 digits only.`,
};

function parse(text: string): DocumentExtraction {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { fields: {}, confidence: 0 };
  }
  const confidence = Math.max(0, Math.min(1, Number(o.confidence) || 0));
  // 'unknown' wraps real fields under .fields; others are flat.
  const fields = (o.fields && typeof o.fields === 'object' ? (o.fields as Record<string, unknown>) : o);
  delete (fields as Record<string, unknown>).confidence;
  return { fields: sanitizeExtraction(fields), confidence };
}

/** Defense-in-depth: drop any full SSN / full account number values. */
export function sanitizeExtraction(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = k.toLowerCase();
    // Never persist a full SSN or full account number under any key.
    if ((key.includes('ssn') || key.includes('social')) && !key.includes('last4')) {
      if (typeof v === 'string') {
        const digits = v.replace(/\D/g, '');
        if (digits.length >= 9) {
          out['ssn_last4'] = digits.slice(-4);
          continue;
        }
      }
      continue;
    }
    if (key.includes('account') && key.includes('number') && !key.includes('last4')) {
      if (typeof v === 'string') {
        const digits = v.replace(/\D/g, '');
        if (digits.length >= 6) {
          out['account_last4'] = digits.slice(-4);
          continue;
        }
      }
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function interpretWithClaude(rawText: string, documentType: DocumentType): Promise<DocumentExtraction> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `${PROMPTS[documentType]}\n\nDOCUMENT TEXT:\n${rawText.substring(0, 4000)}\n\nReturn valid JSON only.`,
      },
    ],
  });
  const block = res.content[0];
  return parse(block && block.type === 'text' ? block.text : '');
}

/** Full pipeline: Textract (gated) -> Claude. Throws TextractNotConfiguredError until AWS is set. */
export async function extractDocumentData(s3Key: string, documentType: DocumentType): Promise<DocumentExtraction> {
  const { rawText, formFields } = await runTextract(s3Key);
  const combined = `${JSON.stringify(formFields)}\n${rawText}`;
  return interpretWithClaude(combined, documentType);
}
