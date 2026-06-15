// Roleplay scenarios + playbook drills for the AI Sales Coach.
// A scenario gives the coach a persona to play (the prospect) plus a coaching brief.
// The client embeds `rolePrompt` into the chat so the model stays in character and
// then grades the rep when asked.

export interface Scenario {
  id: string;
  title: string;
  persona: string;
  difficulty: 'warm-up' | 'realistic' | 'tough';
  goal: string;
  /** System-style framing injected as the first turn of the roleplay. */
  rolePrompt: string;
  opener: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'rate_shopper',
    title: 'The Rate Shopper',
    persona: 'Refi borrower comparing 3 lenders',
    difficulty: 'realistic',
    goal: 'Earn the application without competing on rate alone.',
    rolePrompt:
      'You are role-playing as a borrower named Marcus who is refinancing and has quotes from 3 lenders. You are price-focused, mildly skeptical, and will push hard on "what\'s your rate?". Stay in character as the borrower. Do not coach or break character unless the loan officer types "COACH ME". Make the rep earn it; reward genuine value framing by warming up, and resist generic answers.',
    opener: "Hi, yeah — I'm just calling around. What rate can you do? Lender down the street already gave me a number.",
  },
  {
    id: 'ftb_nervous',
    title: 'Nervous First-Time Buyer',
    persona: 'Anxious FTB, never done this before',
    difficulty: 'warm-up',
    goal: 'Build trust and book the pre-qualification.',
    rolePrompt:
      'You are role-playing as Priya, a first-time homebuyer who is excited but anxious and asks lots of "is this normal?" questions. You worry about down payment and credit. Stay in character as the borrower. Warm up when the rep is reassuring and clear; get more nervous if they use jargon. Only break character if the rep types "COACH ME".',
    opener: "Hi… um, I think I want to buy a house but I honestly don't even know where to start. Is my credit even good enough?",
  },
  {
    id: 'fsbo_realtor',
    title: 'Skeptical Realtor',
    persona: 'Top agent who already has a lender',
    difficulty: 'tough',
    goal: 'Get a 15-minute meeting / become their backup lender.',
    rolePrompt:
      'You are role-playing as Dana, a busy top-producing real estate agent who already has a preferred lender and is protective of your time. You are polite but dismissive of cold outreach. Stay in character. Reward reps who lead with the agent\'s interests and brevity; shut down generic pitches. Break character only if the rep types "COACH ME".',
    opener: "Look, I appreciate the call but I already have a lender I trust. What's this about?",
  },
  {
    id: 'stalled_conditions',
    title: 'Frustrated Borrower in UW',
    persona: 'In underwriting, annoyed by doc requests',
    difficulty: 'realistic',
    goal: 'De-escalate and get the conditions submitted today.',
    rolePrompt:
      'You are role-playing as Tom, a borrower deep in underwriting who is frustrated because you keep getting asked for more documents. You feel jerked around. Stay in character. Calm down when the rep empathizes and gives a clear reason + simple next step; escalate if they\'re defensive. Break character only on "COACH ME".',
    opener: "Another document?? I already sent you everything. This is ridiculous — is this deal even going to close?",
  },
];

export interface Drill {
  id: string;
  title: string;
  category: 'mindset' | 'discovery' | 'closing' | 'pipeline';
  summary: string;
  /** A prompt the rep can fire into the coach chat to go deeper. */
  coachPrompt: string;
}

export const DRILLS: Drill[] = [
  {
    id: 'discovery_questions',
    title: 'The 5 questions that close',
    category: 'discovery',
    summary: 'Stop quoting and start diagnosing. Lead with motivation, timeline, and pain before numbers.',
    coachPrompt: 'Teach me the 5 best discovery questions to ask a new purchase lead and why each one matters. Give me the exact wording.',
  },
  {
    id: 'speed_to_lead',
    title: 'Win the first 5 minutes',
    category: 'pipeline',
    summary: 'Leads contacted within 5 minutes convert dramatically higher. Build a rapid-response routine.',
    coachPrompt: 'Help me design a speed-to-lead routine so I respond to every new lead within 5 minutes. Include text + call sequencing.',
  },
  {
    id: 'reframe_rate',
    title: 'Sell value, not rate',
    category: 'closing',
    summary: 'Reframe price objections around total cost, certainty of close, and service.',
    coachPrompt: 'Coach me on reframing a rate objection into a value conversation. Give me 3 reframes I can say out loud.',
  },
  {
    id: 'pipeline_triage',
    title: 'Work the right 20%',
    category: 'pipeline',
    summary: 'Prioritize leads by intent and timeline so your hours go to deals that actually close.',
    coachPrompt: 'Help me build a simple system to triage my pipeline each morning and focus on the highest-intent leads.',
  },
  {
    id: 'mindset_no',
    title: 'Hearing “no” without flinching',
    category: 'mindset',
    summary: 'Detach from the outcome of any single call. Volume + composure beats pressure.',
    coachPrompt: 'Give me a short mindset routine to stay confident and detached after a string of rejections.',
  },
  {
    id: 'referral_ask',
    title: 'Ask for the referral, every time',
    category: 'closing',
    summary: 'The best time to ask is at peak happiness — clear-to-close and post-close.',
    coachPrompt: 'Teach me how and when to ask happy borrowers and agents for referrals without being awkward.',
  },
];
