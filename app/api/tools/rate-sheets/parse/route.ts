// Phase 114 — parse a pasted rate-sheet into structured products + LLPAs via Claude
// Haiku, then store. (No server-side PDF text lib is installed, so extraction runs on
// pasted text; an optional PDF can be stored separately as the source-of-record.)
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

const MODEL = 'claude-haiku-4-5-20251001';
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const EXTRACT_PROMPT = (text: string) =>
  `Extract all mortgage rate sheet data from this document into structured JSON. Include:
1. Base rates by loan type, term, and amortization
2. All LLPAs (price adjusters) with their FICO/LTV conditions
3. Lock periods and loan limits

Return ONLY valid JSON, no other text. Use this exact shape:
{
  "products": [{ "loanType": "conventional", "termYears": 30, "amortizationType": "fixed", "baseRate": 6.875, "basePrice": 100.0, "lockPeriodDays": 30, "minFico": 620, "maxFico": null, "minLtv": null, "maxLtv": 95, "minLoanAmount": null, "maxLoanAmount": 766550 }],
  "llpas": [{ "adjusterName": "FICO 700-719 / LTV 75.01-80", "ficoMin": 700, "ficoMax": 719, "ltvMin": 75.01, "ltvMax": 80, "loanPurpose": "purchase", "adjustment": -0.5 }]
}
amortizationType is one of: fixed, arm_5_1, arm_7_1, arm_10_1. adjustment is in price points (negative = worse for the borrower). Use null for anything not specified.

Rate sheet text:
${text.slice(0, 12000)}`;

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const lenderName = (body.lenderName ?? '').toString().trim();
  const effectiveDate = (body.effectiveDate ?? '').toString().slice(0, 10);
  const text = (body.text ?? '').toString();
  if (!lenderName || !effectiveDate) return NextResponse.json({ error: 'lenderName and effectiveDate are required' }, { status: 400 });
  if (text.trim().length < 40) return NextResponse.json({ error: 'Paste the rate sheet text to parse' }, { status: 400 });

  // ── Claude Haiku extraction ─────────────────────────────────────────────────
  let parsed: { products?: any[]; llpas?: any[] } = {};
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: EXTRACT_PROMPT(text) }],
    });
    const raw = res.content[0]?.type === 'text' ? res.content[0].text : '{}';
    const jsonStr = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    parsed = JSON.parse(jsonStr);
  } catch (e: any) {
    return NextResponse.json({ error: 'AI extraction failed — check the pasted text', detail: e?.message }, { status: 502 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: sheet, error: sheetErr } = await sb
    .from('rate_sheets')
    .insert({
      org_id: orgId,
      lo_id: profile.id,
      lender_name: lenderName,
      effective_date: effectiveDate,
      expiration_date: body.expirationDate ? body.expirationDate.toString().slice(0, 10) : null,
      raw_extracted_json: parsed,
      loan_types: Array.isArray(body.loanTypes) ? body.loanTypes : [],
      parsed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (sheetErr || !sheet) return NextResponse.json({ error: 'Could not save rate sheet' }, { status: 500 });

  // ── Products (skip rows missing required fields) ────────────────────────────
  const products = (parsed.products ?? [])
    .map((p) => ({
      rate_sheet_id: sheet.id,
      loan_type: (p.loanType ?? '').toString().toLowerCase() || null,
      term_years: num(p.termYears),
      amortization_type: (p.amortizationType ?? 'fixed').toString(),
      base_rate: num(p.baseRate),
      base_price: num(p.basePrice),
      lock_period_days: num(p.lockPeriodDays) ?? 30,
      min_fico: num(p.minFico),
      max_fico: num(p.maxFico),
      min_ltv: num(p.minLtv),
      max_ltv: num(p.maxLtv),
      min_loan_amount: num(p.minLoanAmount),
      max_loan_amount: num(p.maxLoanAmount),
    }))
    .filter((p) => p.loan_type && p.term_years != null && p.base_rate != null);
  if (products.length) await sb.from('rate_sheet_products').insert(products);

  const llpas = (parsed.llpas ?? [])
    .map((l) => ({
      rate_sheet_id: sheet.id,
      adjuster_name: (l.adjusterName ?? '').toString() || 'Adjuster',
      fico_min: num(l.ficoMin),
      fico_max: num(l.ficoMax),
      ltv_min: num(l.ltvMin),
      ltv_max: num(l.ltvMax),
      loan_purpose: l.loanPurpose ? l.loanPurpose.toString() : null,
      adjustment: num(l.adjustment),
    }))
    .filter((l) => l.adjustment != null);
  if (llpas.length) await sb.from('rate_sheet_llpas').insert(llpas);

  return NextResponse.json({ sheetId: sheet.id, productsFound: products.length, llpasFound: llpas.length, raw: parsed });
}
