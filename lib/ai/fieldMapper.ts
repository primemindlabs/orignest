/**
 * Phase 30.3 — map extracted document fields onto the 1003.
 *
 * The real 1003 lives in loan_applications jsonb sections (employment_data,
 * assets_data), NOT on leads. Each mapping points an extracted key at a
 * (section, key) in loan_applications.
 */
import type { DocumentType } from '@/lib/ai/documentExtractor';

export interface FieldMapping {
  from: string;       // key in the extraction
  section: string;    // loan_applications jsonb column
  key: string;        // key within that section
  label: string;      // human label
  numeric?: boolean;  // compare numerically for discrepancies
}

export const FIELD_MAP: Record<DocumentType, FieldMapping[]> = {
  paystub: [
    { from: 'employer_name', section: 'employment_data', key: 'employer_name', label: 'Employer' },
    { from: 'gross_ytd', section: 'employment_data', key: 'base_income_ytd', label: 'Gross YTD', numeric: true },
    { from: 'gross_this_period', section: 'employment_data', key: 'current_pay_period_gross', label: 'Gross this period', numeric: true },
    { from: 'pay_frequency', section: 'employment_data', key: 'pay_frequency', label: 'Pay frequency' },
  ],
  w2: [
    { from: 'employer_name', section: 'employment_data', key: 'employer_name', label: 'Employer' },
    { from: 'box1_wages', section: 'employment_data', key: 'w2_wages_prior_year', label: 'W-2 Box 1 wages', numeric: true },
    { from: 'tax_year', section: 'employment_data', key: 'w2_tax_year', label: 'Tax year' },
  ],
  bank_statement: [
    { from: 'bank_name', section: 'assets_data', key: 'bank_name', label: 'Bank' },
    { from: 'account_last4', section: 'assets_data', key: 'account_last4', label: 'Account (last 4)' },
    { from: 'account_type', section: 'assets_data', key: 'account_type', label: 'Account type' },
    { from: 'ending_balance', section: 'assets_data', key: 'verified_asset_balance', label: 'Verified balance', numeric: true },
  ],
  '1099': [
    { from: 'payer_name', section: 'employment_data', key: 'payer_name', label: 'Payer' },
    { from: 'box1_amount', section: 'employment_data', key: 'income_1099_amount', label: '1099 income', numeric: true },
    { from: 'tax_year', section: 'employment_data', key: 'income_1099_year', label: 'Tax year' },
  ],
  tax_return: [
    { from: 'agi', section: 'employment_data', key: 'agi', label: 'AGI', numeric: true },
    { from: 'total_income', section: 'employment_data', key: 'total_income_tax_return', label: 'Total income', numeric: true },
    { from: 'schedule_c_net', section: 'employment_data', key: 'schedule_c_net', label: 'Schedule C net', numeric: true },
  ],
  unknown: [],
};

export interface Discrepancy {
  field: string;
  label: string;
  extracted_value: unknown;
  existing_value: unknown;
  severity: 'info' | 'warning' | 'flag';
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const x = parseFloat(v.replace(/[$,%\s]/g, ''));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

/** Compare extracted values to what's already in the application sections. */
export function buildDiscrepancies(
  documentType: DocumentType,
  extracted: Record<string, unknown>,
  app: Record<string, Record<string, unknown> | null | undefined>
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const m of FIELD_MAP[documentType]) {
    const ev = extracted[m.from];
    if (ev == null || ev === '') continue;
    const existing = (app[m.section] ?? {})[m.key];
    if (existing == null || existing === '') continue;

    if (m.numeric) {
      const a = num(ev);
      const b = num(existing);
      if (a != null && b != null && b !== 0) {
        const pctDiff = Math.abs(a - b) / Math.abs(b);
        if (pctDiff >= 0.2) out.push({ field: m.key, label: m.label, extracted_value: ev, existing_value: existing, severity: 'flag' });
        else if (pctDiff >= 0.05) out.push({ field: m.key, label: m.label, extracted_value: ev, existing_value: existing, severity: 'warning' });
      }
    } else if (String(ev).trim().toLowerCase() !== String(existing).trim().toLowerCase()) {
      out.push({ field: m.key, label: m.label, extracted_value: ev, existing_value: existing, severity: 'info' });
    }
  }
  return out;
}

/**
 * Produce the patched loan_applications sections for a confirmed extraction.
 * Returns the sections to upsert + the list of applied field labels.
 */
export function applyExtractionToApplication(
  documentType: DocumentType,
  extracted: Record<string, unknown>,
  app: Record<string, Record<string, unknown> | null | undefined>
): { patch: Record<string, Record<string, unknown>>; applied: string[] } {
  const patch: Record<string, Record<string, unknown>> = {};
  const applied: string[] = [];
  for (const m of FIELD_MAP[documentType]) {
    const ev = extracted[m.from];
    if (ev == null || ev === '') continue;
    if (!patch[m.section]) patch[m.section] = { ...(app[m.section] ?? {}) };
    patch[m.section][m.key] = ev;
    applied.push(m.label);
  }
  return { patch, applied };
}
