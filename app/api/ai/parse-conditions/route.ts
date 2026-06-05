import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { recordAIFeedbackInput } from '@/lib/ai/learning';

const client = new Anthropic();

interface ParsedCondition {
  condition_text: string;
  category: 'income' | 'credit' | 'assets' | 'property' | 'title' | 'insurance' | 'other';
  priority: 'standard' | 'prior_to_docs' | 'prior_to_funding' | 'prior_to_closing';
  notes: string | null;
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.conditionsText || typeof body.conditionsText !== 'string') {
    return NextResponse.json({ error: 'conditionsText required' }, { status: 400 });
  }

  const { conditionsText } = body as { conditionsText: string };

  const systemPrompt = `You are a mortgage processing assistant. Parse underwriting conditions into structured JSON.

For each condition you identify:
- condition_text: the exact condition requirement (clear, concise)
- category: one of income | credit | assets | property | title | insurance | other
- priority: one of standard | prior_to_docs | prior_to_funding | prior_to_closing
  * "Prior to Docs" = needed before loan documents are drawn
  * "Prior to Funding" = needed before wire/funding
  * "Prior to Closing" = needed before closing table
  * "Standard" = general conditions without a specific timing gate
- notes: any additional context or clarification from the UW (or null)

Return ONLY a valid JSON object with a "conditions" array. No markdown, no explanation.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Parse these underwriting conditions into structured JSON:\n\n${conditionsText}`,
        },
      ],
      system: systemPrompt,
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

    let parsed: { conditions: ParsedCondition[] };
    try {
      // Strip any accidental markdown fences
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: 'AI parse failed', raw: rawText }, { status: 500 });
    }

    if (!Array.isArray(parsed.conditions)) {
      return NextResponse.json({ error: 'Unexpected AI response shape' }, { status: 500 });
    }

    // Log for AI feedback tracking (no user action yet — will be set when they save/reject)
    if (orgId) {
      await recordAIFeedbackInput({
        orgId,
        userId,
        aiType: 'conditions_parse',
        inputContext: { conditionsText: conditionsText.slice(0, 500) },
        aiOutput: JSON.stringify(parsed.conditions),
      }).catch(() => {
        // Non-fatal — feedback tracking should never block the response
      });
    }

    return NextResponse.json({ conditions: parsed.conditions });
  } catch (err) {
    console.error('[parse-conditions]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
