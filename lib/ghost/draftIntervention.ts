// Phase 85 — AI-draft a re-engagement SMS (Haiku) for a quiet borrower.
// TCPA-safe: warm/not pushy, includes the LO name, < 140 chars, NO rates or commitments.
// Always returns a usable draft — falls back to a template if the AI call is unavailable.

import Anthropic from '@anthropic-ai/sdk';

export type DraftInput = {
  borrowerFirstName: string;
  loName: string;
  daysSinceContact: number | null;
  stage: string | null;
};

function fallbackDraft({ borrowerFirstName, loName }: DraftInput): string {
  const name = borrowerFirstName || 'there';
  return `Hi ${name}, it's ${loName || 'your loan officer'}. Just checking in on your loan — happy to answer any questions or help with next steps whenever you're ready.`.slice(
    0,
    140,
  );
}

export async function draftGhostIntervention(input: DraftInput): Promise<{ message: string; ai: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY) return { message: fallbackDraft(input), ai: false };
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system:
        'You are an AI assistant for mortgage loan officers. Draft a brief, friendly re-engagement text message to a borrower who has gone quiet. ' +
        'The tone should be warm and helpful, not pushy. Include the LO\'s name. Keep it under 140 characters. ' +
        'Do NOT include any rate information, numbers, or make any loan commitments. Return ONLY the message text.',
      messages: [
        {
          role: 'user',
          content: `Borrower: ${input.borrowerFirstName}. LO: ${input.loName}. Days since last contact: ${input.daysSinceContact ?? 'unknown'}. Loan stage: ${input.stage ?? 'unknown'}. Write a re-engagement SMS.`,
        },
      ],
    });
    const block = msg.content[0];
    const text = block?.type === 'text' ? block.text.trim() : '';
    return text ? { message: text.slice(0, 160), ai: true } : { message: fallbackDraft(input), ai: false };
  } catch {
    return { message: fallbackDraft(input), ai: false };
  }
}
