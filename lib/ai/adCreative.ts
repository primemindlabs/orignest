/**
 * Phase 33.1 — Ad creative generation + compliance review (server-only, Sonnet).
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-5';

export type AdType = 'purchase' | 'refinance' | 'fha' | 'va' | 'heloc' | 'coop';
export type AdPlatform = 'meta' | 'google' | 'both';

export interface AdVariant {
  variant: number;
  headline: string;
  primary_text: string;
  cta: string;
  compliance_notes: string;
}

export interface ComplianceIssue {
  severity: 'critical' | 'high' | 'medium';
  field: string;
  issue: string;
  suggestion: string;
}
export interface ComplianceResult {
  passed: boolean;
  issues: ComplianceIssue[];
  summary: string;
}

const AD_TYPE_CONTEXT: Record<AdType, string> = {
  purchase: 'First-time buyers and move-up buyers looking to purchase a home',
  refinance: 'Homeowners considering refinancing their existing mortgage',
  fha: 'Buyers with limited down payment (FHA allows 3.5% down), first-time buyers',
  va: 'Active duty military, veterans, and surviving spouses — VA loans have no down payment requirement',
  heloc: 'Homeowners looking to tap equity for home improvement, debt consolidation, or major expenses',
  coop: 'Home buyers and sellers working with a real estate agent',
};

const PLATFORM_LIMITS: Record<AdPlatform, { headline: number; body: number }> = {
  meta: { headline: 40, body: 125 },
  google: { headline: 30, body: 90 },
  both: { headline: 30, body: 90 },
};

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
function firstJson<T>(text: string, fallback: T): T {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const a = raw.indexOf('['); const b = raw.lastIndexOf(']');
  const c = raw.indexOf('{'); const d = raw.lastIndexOf('}');
  if (a !== -1 && b > a && (a < c || c === -1)) raw = raw.slice(a, b + 1);
  else if (c !== -1 && d > c) raw = raw.slice(c, d + 1);
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export async function generateAdVariants(input: {
  ad_type: AdType;
  platform: AdPlatform;
  lo_name: string;
  lo_nmls: string;
  company_name: string;
  state: string;
  key_message?: string;
  coop_realtor_name?: string;
}): Promise<AdVariant[]> {
  const limits = PLATFORM_LIMITS[input.platform];
  const prompt = `You are a licensed mortgage marketing specialist who writes compliant advertising copy.

Generate 3 different mortgage ad creative variants for:
- Ad type: ${input.ad_type} (${AD_TYPE_CONTEXT[input.ad_type]})
- Platform: ${input.platform}
- LO: ${input.lo_name}, NMLS# ${input.lo_nmls}
- Company: ${input.company_name}
- State: ${input.state}
${input.key_message ? `- Key message focus: ${input.key_message}` : ''}
${input.coop_realtor_name ? `- Co-marketing partner realtor: ${input.coop_realtor_name}` : ''}

CHARACTER LIMITS (hard — DO NOT EXCEED): Headline ${limits.headline} chars; Body ${limits.body} chars.

REQUIRED COMPLIANCE RULES (violations cause rejection):
1. NMLS# ${input.lo_nmls} must appear in every variant.
2. Never quote a specific rate/APR unless you also include the full APR disclosure.
3. No superlative rate claims ("lowest", "best", "unbeatable").
4. Never promise approval ("guaranteed approval", "everyone approved").
5. Equal Housing Lender / Equal Housing Opportunity must be referenced.
6. For VA ads: include "Not endorsed by the Department of Veterans Affairs".
7. For FHA ads: do not imply FHA endorsement.
8. No discriminatory language or targeting (race, religion, national origin, sex, age, familial status).
9. No "no closing costs" unless truly zero.

Return ONLY a JSON array of exactly 3 variants:
[{ "variant": 1, "headline": "...", "primary_text": "...", "cta": "Apply Now|Learn More|Get Quote|Contact Us", "compliance_notes": "..." }]`;

  const res = await client().messages.create({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  const arr = firstJson<AdVariant[]>(block && block.type === 'text' ? block.text : '', []);
  return Array.isArray(arr) ? arr.slice(0, 3) : [];
}

export async function reviewAdCompliance(input: {
  headline: string;
  primary_text?: string | null;
  description?: string | null;
  ad_type: AdType;
  platform: AdPlatform;
  nmls: string;
}): Promise<ComplianceResult> {
  const prompt = `You are a mortgage advertising compliance officer. Review this ad.

Ad type: ${input.ad_type}
Platform: ${input.platform}
NMLS#: ${input.nmls || '(MISSING)'}

HEADLINE: ${input.headline}
BODY: ${input.primary_text ?? ''}
DESCRIPTION: ${input.description ?? ''}

CRITICAL (regulatory action): no NMLS#; specific rate without APR disclosure; guaranteed approval; discriminatory targeting; false/misleading; VA/FHA endorsement implied.
HIGH (required): missing Equal Housing Lender/Opportunity; superlative rate claims; "no closing costs" unverified; VA ads missing "not endorsed by DVA".
MEDIUM (best practice): vague promises without substantiation; deceptive urgency.

Return JSON:
{ "passed": true|false, "issues": [{ "severity": "critical|high|medium", "field": "headline|body|description|overall", "issue": "...", "suggestion": "..." }], "summary": "one sentence" }
Only fail (passed:false) on CRITICAL or HIGH issues.`;

  const res = await client().messages.create({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  const raw = block && block.type === 'text' ? block.text : '';
  const parsed = firstJson<Partial<ComplianceResult>>(raw, {});
  return {
    passed: Boolean(parsed.passed),
    issues: Array.isArray(parsed.issues) ? (parsed.issues as ComplianceIssue[]) : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}
