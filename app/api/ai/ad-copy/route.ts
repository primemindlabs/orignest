import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

interface AdCopyRequest {
  platform: 'facebook' | 'google' | 'instagram' | 'linkedin';
  goal: string;
  targetAudience: {
    states?: string[];
    ageRange?: { min: number; max: number };
    homeownerStatus?: string;
    loanType?: string;
    lifeEvents?: string[];
  };
  loanType: string;
}

interface AdCopyVariation {
  headline: string;
  body: string;
  cta: string;
}

interface AdCopyResponse {
  variations: AdCopyVariation[];
  complianceFlag: boolean;
  complianceNote: string | null;
}

const HEADLINE_LIMITS: Record<string, number> = {
  google: 30,
  facebook: 40,
  instagram: 40,
  linkedin: 40,
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as AdCopyRequest;
    const { platform, goal, targetAudience, loanType } = body;

    if (!platform || !goal || !loanType) {
      return NextResponse.json({ error: 'platform, goal, and loanType are required' }, { status: 400 });
    }

    const headlineLimit = HEADLINE_LIMITS[platform] ?? 40;

    const systemPrompt = `You are a licensed mortgage marketing compliance expert and copywriter. You write ad copy for mortgage loan officers that is:
- Engaging and benefit-focused
- STRICTLY compliant with RESPA, Regulation Z, and FHA/VA advertising guidelines
- Free of guaranteed approval language ("guaranteed approval", "you will qualify", etc.)
- Free of specific rate claims without required disclosures
- Free of discriminatory language (ECOA, Fair Housing Act)
- Includes "Not a commitment to lend. Subject to credit approval." in the compliance note

Respond ONLY with valid JSON matching this exact schema:
{
  "variations": [
    { "headline": string, "body": string, "cta": string },
    { "headline": string, "body": string, "cta": string },
    { "headline": string, "body": string, "cta": string }
  ],
  "complianceFlag": boolean,
  "complianceNote": string | null
}`;

    const userPrompt = `Generate 3 mortgage ad copy variations for:
- Platform: ${platform} (headline max ${headlineLimit} characters)
- Campaign goal: ${goal}
- Loan type focus: ${loanType}
- Target audience: ${JSON.stringify(targetAudience, null, 2)}

Each variation needs: a headline (max ${headlineLimit} chars), body copy (2-3 sentences, platform-appropriate length), and a CTA button text (3-5 words).

Flag complianceFlag as true and explain in complianceNote if any variation contains rate guarantees, approval guarantees, or discriminatory language. Always append "Not a commitment to lend. Subject to credit approval." to the complianceNote.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected AI response format' }, { status: 500 });
    }

    let parsed: AdCopyResponse;
    try {
      parsed = JSON.parse(content.text) as AdCopyResponse;
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Always enforce compliance disclaimer in note
    if (!parsed.complianceNote) {
      parsed.complianceNote = 'Not a commitment to lend. Subject to credit approval.';
    } else if (!parsed.complianceNote.includes('Not a commitment to lend')) {
      parsed.complianceNote += ' Not a commitment to lend. Subject to credit approval.';
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[ai/ad-copy] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 }
    );
  }
}
