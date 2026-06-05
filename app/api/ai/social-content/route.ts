import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

interface SocialContentRequest {
  platform: 'linkedin' | 'instagram' | 'facebook' | 'twitter';
  contentType: string;
  tone: 'professional' | 'conversational' | 'educational';
  includeRate: boolean;
  includeMarket: boolean;
}

interface SocialContentResponse {
  body: string;
  hashtags: string[];
  complianceFlag: boolean;
  complianceNote: string | null;
  bestTimeToPost: string;
}

const PLATFORM_LENGTHS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 2000,
};

const PLATFORM_HASHTAG_COUNTS: Record<string, number> = {
  twitter: 2,
  linkedin: 3,
  instagram: 5,
  facebook: 3,
};

const BEST_TIMES: Record<string, string> = {
  linkedin: 'Tuesday–Thursday, 9–11 AM local time',
  instagram: 'Wednesday–Friday, 11 AM–1 PM or 7–9 PM local time',
  facebook: 'Tuesday–Thursday, 10 AM–12 PM local time',
  twitter: 'Weekdays, 8–10 AM or 6–9 PM local time',
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as SocialContentRequest;
    const { platform, contentType, tone, includeRate, includeMarket } = body;

    if (!platform || !contentType || !tone) {
      return NextResponse.json({ error: 'platform, contentType, and tone are required' }, { status: 400 });
    }

    const maxLength = PLATFORM_LENGTHS[platform] ?? 2000;
    const hashtagCount = PLATFORM_HASHTAG_COUNTS[platform] ?? 3;

    const systemPrompt = `You are a mortgage industry social media expert and compliance officer. You create engaging social content for loan officers that is:
- Platform-appropriate in length and style
- Mortgage compliance-aware (no guaranteed rates, no guaranteed approvals, no discriminatory content)
- Genuinely helpful and educational for homebuyers and investors
- Authentically human-sounding, not generic

Respond ONLY with valid JSON matching this exact schema:
{
  "body": string,
  "hashtags": string[],
  "complianceFlag": boolean,
  "complianceNote": string | null
}`;

    const rateNote = includeRate
      ? 'Include a general reference to current market rates (e.g., "rates have been trending around X% for 30-year conventional" — use a plausible current-ish range, do NOT guarantee specific rates).'
      : 'Do not mention specific rates.';

    const marketNote = includeMarket
      ? 'Include a brief mention of current housing market conditions (inventory, buyer demand, etc.).'
      : '';

    const userPrompt = `Create a ${tone} ${contentType} social media post for a mortgage loan officer.
Platform: ${platform} (max ${maxLength} characters for body)
${rateNote}
${marketNote}
Generate exactly ${hashtagCount} relevant hashtags (without the # prefix in the array).
Flag complianceFlag as true if any claims could be construed as a rate guarantee or approval guarantee. Note "Not a commitment to lend. Subject to credit approval." must appear in complianceNote if any rate or financing is mentioned.`;

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

    let parsed: Omit<SocialContentResponse, 'bestTimeToPost'>;
    try {
      parsed = JSON.parse(content.text) as Omit<SocialContentResponse, 'bestTimeToPost'>;
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Enforce compliance disclaimer when rates are mentioned
    if (includeRate && parsed.complianceNote && !parsed.complianceNote.includes('Not a commitment to lend')) {
      parsed.complianceNote += ' Not a commitment to lend. Subject to credit approval.';
    } else if (includeRate && !parsed.complianceNote) {
      parsed.complianceNote = 'Not a commitment to lend. Subject to credit approval.';
    }

    const response: SocialContentResponse = {
      ...parsed,
      bestTimeToPost: BEST_TIMES[platform] ?? 'Weekdays, 9 AM–12 PM local time',
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[ai/social-content] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 }
    );
  }
}
