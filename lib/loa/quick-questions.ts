export const QUICK_QUESTIONS = [
  "What's my average time to close this quarter?",
  "Which realtors haven't sent a deal in 60+ days?",
  "How many ghost-risk borrowers do I have right now?",
  "What's my best performing lead source?",
  "Where is my pipeline stuck?",
  "How many loans am I funding this month?",
] as const;

export type QuickQuestion = (typeof QUICK_QUESTIONS)[number];
