// Phase 87 — generate Ashley's voicemail-acknowledgment SMS (Haiku). TCPA/compliance-safe:
// brief, warm, no rate info or loan commitments. Always returns a usable message.

import Anthropic from '@anthropic-ai/sdk';

export async function generateAshleySMS(
  transcript: string,
  lead: { first_name?: string | null; stage?: string | null } | null,
  loName: string,
): Promise<string> {
  const fallback = `Hi! This is ${loName || 'your loan officer'} — I got your voicemail and will call you back shortly. Feel free to text me here anytime!`.slice(0, 160);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const isKnown = !!lead;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 160,
      system:
        `You are Ashley, an AI assistant for mortgage loan officer ${loName}. A borrower just left a voicemail. ` +
        `Send a brief, friendly acknowledgment SMS. Keep it under 160 characters. Be warm but professional. ` +
        (isKnown
          ? `This is a known borrower named ${lead?.first_name} currently in the ${lead?.stage ?? 'loan'} stage. `
          : `This caller is not yet in the system. `) +
        `Do NOT make rate commitments or loan promises. Do NOT include any rate information. Return ONLY the message text.`,
      messages: [
        { role: 'user', content: `Voicemail transcript: "${transcript || '(no transcript)'}" . Draft the acknowledgment SMS from ${loName}.` },
      ],
    });
    const block = msg.content[0];
    const text = block?.type === 'text' ? block.text.trim() : '';
    return text ? text.slice(0, 160) : fallback;
  } catch (e) {
    console.error('[ashleySms]', e);
    return fallback;
  }
}
