/**
 * AI campaign builder (server-only, Claude Haiku). Turns a plain-language goal
 * into a multi-step drip campaign plan. No-key safe: falls back to a sensible
 * template when ANTHROPIC_API_KEY is unset so the create flow always works.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

export const CAMPAIGN_TYPES = [
  'drip', 'milestone', 'reactivation', 'referral_ask', 'educational',
  'birthday', 'loan_anniversary', 'holiday', 'pre_approval_expiring',
] as const;
export const CAMPAIGN_CATEGORIES = ['nurture', 'lifecycle', 'retention', 'referral', 'education'] as const;

export interface CampaignStepPlan {
  step_number: number;
  delay_days: number;
  channel: 'email' | 'sms';
  subject: string | null;
  body: string;
  ai_personalize: boolean;
}

export interface CampaignPlan {
  name: string;
  type: string;
  category: string;
  description: string;
  steps: CampaignStepPlan[];
}

function clampType(t: string): string {
  return (CAMPAIGN_TYPES as readonly string[]).includes(t) ? t : 'drip';
}
function clampCategory(c: string): string {
  return (CAMPAIGN_CATEGORIES as readonly string[]).includes(c) ? c : 'nurture';
}

/** Deterministic fallback used when no API key is available or the model errors. */
function fallbackPlan(goal: string, audience?: string): CampaignPlan {
  const aud = audience?.trim() || 'the lead';
  return {
    name: goal.trim().slice(0, 60) || 'New Nurture Campaign',
    type: 'drip',
    category: 'nurture',
    description: `Auto-drafted sequence for: ${goal.trim()}`.slice(0, 200),
    steps: [
      { step_number: 1, delay_days: 0, channel: 'email', subject: 'Quick hello', body: `Hi {{first_name}}, reaching out about your mortgage goals. Happy to answer any questions whenever you're ready.`, ai_personalize: true },
      { step_number: 2, delay_days: 3, channel: 'sms', subject: null, body: `Hi {{first_name}}, just checking in — want me to put together some options for you?`, ai_personalize: true },
      { step_number: 3, delay_days: 7, channel: 'email', subject: 'A few things that might help', body: `Hi {{first_name}}, here are a couple of resources for ${aud}. No pressure — I'm here when the timing's right.`, ai_personalize: true },
      { step_number: 4, delay_days: 14, channel: 'email', subject: 'Still here for you', body: `Hi {{first_name}}, circling back one more time. Reply anytime and we'll pick up where we left off.`, ai_personalize: true },
    ],
  };
}

export async function generateCampaignPlan(goal: string, audience?: string): Promise<{ plan: CampaignPlan; aiUsed: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY) return { plan: fallbackPlan(goal, audience), aiUsed: false };

  const prompt = `You are a mortgage marketing assistant. Design a compliant multi-step outreach campaign for a loan officer.

GOAL: ${goal}
${audience ? `AUDIENCE: ${audience}` : ''}

Rules:
- 3 to 6 steps, paced over days (first step usually day 0).
- Mix email and SMS. SMS bodies must be short (<60 words) and conversational.
- Use {{first_name}} as a merge token where natural. First person, warm, never pushy.
- TCPA/RESPA safe: NO specific interest rates, APRs, payment amounts, or guarantees.
- Set ai_personalize=true for steps that should be tailored per borrower at send time.

Return ONLY valid JSON, no prose:
{
  "name": string (<=60 chars),
  "type": one of ${JSON.stringify(CAMPAIGN_TYPES)},
  "category": one of ${JSON.stringify(CAMPAIGN_CATEGORIES)},
  "description": string (<=180 chars),
  "steps": [ { "step_number": number, "delay_days": number, "channel": "email"|"sms", "subject": string|null, "body": string, "ai_personalize": boolean } ]
}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
    const block = res.content[0];
    const text = block && block.type === 'text' ? block.text : '';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const raw = JSON.parse(json) as Partial<CampaignPlan>;

    const steps: CampaignStepPlan[] = (raw.steps ?? [])
      .slice(0, 6)
      .map((s, i): CampaignStepPlan => ({
        step_number: i + 1,
        delay_days: Math.max(0, Math.round(Number(s.delay_days ?? 0))),
        channel: s.channel === 'sms' ? 'sms' : 'email',
        subject: s.channel === 'sms' ? null : (s.subject ?? null),
        body: String(s.body ?? '').trim(),
        ai_personalize: s.ai_personalize !== false,
      }))
      .filter((s) => s.body.length > 0);

    if (steps.length === 0) return { plan: fallbackPlan(goal, audience), aiUsed: false };

    return {
      plan: {
        name: String(raw.name ?? goal).slice(0, 60),
        type: clampType(String(raw.type ?? 'drip')),
        category: clampCategory(String(raw.category ?? 'nurture')),
        description: String(raw.description ?? '').slice(0, 200),
        steps,
      },
      aiUsed: true,
    };
  } catch (err) {
    console.error('[campaignBuilder] generation failed, using fallback', err);
    return { plan: fallbackPlan(goal, audience), aiUsed: false };
  }
}
