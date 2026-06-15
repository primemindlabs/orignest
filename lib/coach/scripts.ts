// Sales script library for the AI Sales Coach. Curated, compliant scaffolds an LO
// can copy and adapt — deliberately free of rate/APR/payment promises (TRID/UDAAP).
// These are talk tracks, not legal advice; the coach can personalize them on request.

export interface Script {
  id: string;
  title: string;
  channel: 'call' | 'voicemail' | 'sms' | 'email';
  body: string;
}

export interface ScriptCategory {
  id: string;
  label: string;
  blurb: string;
  scripts: Script[];
}

export const SCRIPT_CATEGORIES: ScriptCategory[] = [
  {
    id: 'first_contact',
    label: 'First Contact',
    blurb: 'Speed-to-lead openers that build rapport in the first 60 seconds.',
    scripts: [
      {
        id: 'inbound_open',
        title: 'Inbound lead — live answer',
        channel: 'call',
        body: `Hi [First Name], this is [Your Name] with [Company] — I saw you just requested information about [purchase/refinance]. Did I catch you at an okay time?\n\nGreat. So I don't waste your time, let me ask two quick things: are you looking to buy/refi in the next few months, or just gathering info right now? … And have you already started looking at homes / talked with anyone about your options?\n\nPerfect — here's how I can help. The fastest next step is a quick pre-qualification so you know exactly what you're working with. Takes about 10 minutes. Want to knock it out now or would later today work better?`,
      },
      {
        id: 'speed_vm',
        title: 'No answer — voicemail',
        channel: 'voicemail',
        body: `Hi [First Name], it's [Your Name] at [Company] returning your request about [purchase/refi]. I've got a couple of options that could be a good fit and I'd love to walk you through them. I'll shoot you a quick text too — call or text me back at [number] whenever you get a sec. Talk soon!`,
      },
      {
        id: 'speed_sms',
        title: 'Speed-to-lead text',
        channel: 'sms',
        body: `Hi [First Name], this is [Your Name] with [Company] — thanks for reaching out about your [home loan/refi]. When's a good time for a quick 10-min call so I can map out your options? Reply STOP to opt out.`,
      },
    ],
  },
  {
    id: 'follow_up',
    label: 'Follow-Up & Nurture',
    blurb: 'Re-engage leads that went quiet without sounding desperate.',
    scripts: [
      {
        id: 'gone_quiet',
        title: 'Lead went quiet after pre-qual',
        channel: 'email',
        body: `Subject: Still here when you're ready, [First Name]\n\nHi [First Name],\n\nNo pressure at all — I know life gets busy. I wanted to check in and see where your head's at on the [home purchase/refi]. Whether you're ready to move now or just keeping an eye on things, I'm happy to be a resource.\n\nIf it's helpful, I can put together an updated breakdown of your options so you've got it on hand. Just reply and let me know.\n\nTalk soon,\n[Your Name]`,
      },
      {
        id: 'reactivation',
        title: '30-day reactivation',
        channel: 'sms',
        body: `Hi [First Name], [Your Name] here. Things have shifted in the market since we last talked and it may be worth a fresh look at your numbers. Want me to run an updated scenario for you? Reply STOP to opt out.`,
      },
    ],
  },
  {
    id: 'objections',
    label: 'Objection Handling',
    blurb: 'Acknowledge, reframe, and move forward — never argue.',
    scripts: [
      {
        id: 'rate_shopper',
        title: '“I’m just shopping for the lowest rate”',
        channel: 'call',
        body: `Totally fair — you should compare. Here's what I'd gently point out: the headline number is only part of the story. Two offers with the same rate can cost very differently once you factor in fees, lock terms, and whether the lender actually closes on time.\n\nWhat I do is lay it all out side by side so you can compare apples to apples — and I'll be straight with you if someone else's offer is genuinely better. Can I put that comparison together for you?`,
      },
      {
        id: 'think_about_it',
        title: '“I need to think about it”',
        channel: 'call',
        body: `Absolutely — this is a big decision and you should be comfortable. Just so I can help: is it the numbers, the timing, or something about the process that you want to think through? … Got it. Let's do this — I'll send you [the specific thing], and let's set a quick 10-minute follow-up for [day] so you're not stuck doing all the homework alone. Sound good?`,
      },
      {
        id: 'spouse',
        title: '“I need to talk to my spouse/partner”',
        channel: 'call',
        body: `Makes complete sense — this should be a joint decision. Would it help if I put together a simple one-pager you can both look at together? And honestly, the easiest thing is to get you both on a quick call so I can answer questions in real time instead of playing telephone. What evening works for the two of you?`,
      },
    ],
  },
  {
    id: 'realtor',
    label: 'Realtor Partnerships',
    blurb: 'Open doors with agents and become their go-to lender.',
    scripts: [
      {
        id: 'agent_intro',
        title: 'Cold intro to a new agent',
        channel: 'call',
        body: `Hi [Agent Name], this is [Your Name] with [Company] — I work with a lot of buyers in [area] and your name keeps coming up for great listings. I'm not here to pitch you; I'd just love 15 minutes to learn how you like to work with a lender so I can make your transactions smoother. Coffee this week, or a quick call?`,
      },
      {
        id: 'agent_value',
        title: 'Why partner with me',
        channel: 'email',
        body: `Subject: Making your buyers' financing the easy part\n\nHi [Agent Name],\n\nQuick intro — I'm [Your Name] with [Company]. What agents tell me they value most: I answer my phone, I pre-approve fast, and I keep you updated at every milestone so you're never chasing me for status.\n\nI'd love to be a backup option on your next deal so you can see how I work. Open to a quick call this week?\n\nBest,\n[Your Name]`,
      },
    ],
  },
  {
    id: 'milestones',
    label: 'In-Process & Closing',
    blurb: 'Keep borrowers calm and informed through underwriting to close.',
    scripts: [
      {
        id: 'doc_request',
        title: 'Requesting conditions without alarm',
        channel: 'sms',
        body: `Hi [First Name], great news — your file's moving through underwriting. They asked for a couple of quick items to keep things on track: [list]. Easiest way to send is [method]. Knock these out today and we stay right on schedule. Thanks! Reply STOP to opt out.`,
      },
      {
        id: 'clear_to_close',
        title: 'Clear to close celebration',
        channel: 'call',
        body: `[First Name]! Calling with the words you've been waiting for — you are clear to close. Here's what happens next: [signing logistics]. You did the hard part. I'll be with you all the way to the keys. Congratulations!`,
      },
    ],
  },
];
