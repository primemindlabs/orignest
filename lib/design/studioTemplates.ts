// Template library for the Canva-like Design Studio (co-marketing + social).
// Templates are style/copy specs; the studio canvas renders them at a fixed design
// size and scales to fit. Each template varies by visual style, aspect, accent, and
// default copy — so picking one feels like picking a Canva template.

export type StudioStyle = 'bold-gradient' | 'clean-light' | 'dark-luxe' | 'editorial';
export type StudioAspect = 'square' | 'story' | 'flyer' | 'landscape';

export interface StudioField {
  key: 'eyebrow' | 'headline' | 'subheadline' | 'body' | 'cta';
  label: string;
  default: string;
  multiline?: boolean;
}

export interface StudioTemplate {
  id: string;
  name: string;
  category: string;
  surface: 'co_marketing' | 'social';
  style: StudioStyle;
  aspect: StudioAspect;
  accent: string;
  fields: StudioField[];
  /** Whether the realtor co-brand block is shown by default. */
  coBrand: boolean;
}

export const ASPECT_DIM: Record<StudioAspect, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  flyer: { w: 1080, h: 1400 },
  landscape: { w: 1200, h: 675 },
};

const f = (key: StudioField['key'], label: string, def: string, multiline = false): StudioField => ({ key, label, default: def, multiline });

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  // ── Co-marketing ──
  {
    id: 'just-listed', name: 'Just Listed', category: 'Listings', surface: 'co_marketing',
    style: 'bold-gradient', aspect: 'square', accent: '#2563eb', coBrand: true,
    fields: [
      f('eyebrow', 'Eyebrow', 'JUST LISTED'),
      f('headline', 'Headline', 'Your Dream Home Awaits'),
      f('subheadline', 'Subheadline', '4 Bed · 3 Bath · 2,400 sqft'),
      f('body', 'Details', 'Schedule a private showing today. Financing options ready when you are.', true),
      f('cta', 'Call to action', 'Ask me about getting pre-approved'),
    ],
  },
  {
    id: 'open-house', name: 'Open House', category: 'Listings', surface: 'co_marketing',
    style: 'clean-light', aspect: 'flyer', accent: '#0f766e', coBrand: true,
    fields: [
      f('eyebrow', 'Eyebrow', 'OPEN HOUSE'),
      f('headline', 'Headline', 'Saturday 1–4 PM'),
      f('subheadline', 'Address', '123 Maple Street'),
      f('body', 'Details', 'Tour the home and get answers on financing all in one stop.', true),
      f('cta', 'Call to action', 'Get pre-approved before you tour'),
    ],
  },
  {
    id: 'just-closed', name: 'Just Closed', category: 'Wins', surface: 'co_marketing',
    style: 'dark-luxe', aspect: 'square', accent: '#C9A95C', coBrand: true,
    fields: [
      f('eyebrow', 'Eyebrow', 'JUST CLOSED'),
      f('headline', 'Headline', 'Another Happy Homeowner'),
      f('subheadline', 'Subheadline', 'Proud to be part of the journey'),
      f('body', 'Details', 'Thinking about buying or refinancing? Let’s talk about your options.', true),
      f('cta', 'Call to action', 'Start your home loan today'),
    ],
  },
  {
    id: 'partner-spotlight', name: 'Partner Spotlight', category: 'Partnership', surface: 'co_marketing',
    style: 'editorial', aspect: 'landscape', accent: '#7c3aed', coBrand: true,
    fields: [
      f('eyebrow', 'Eyebrow', 'PREFERRED PARTNERS'),
      f('headline', 'Headline', 'A Better Way to Buy'),
      f('subheadline', 'Subheadline', 'Your agent + lender, working as one team'),
      f('body', 'Details', 'From offer to keys, we keep your transaction on track and on time.', true),
      f('cta', 'Call to action', 'Reach out to get started'),
    ],
  },
  // ── Social ──
  {
    id: 'rate-environment', name: 'Market Insight', category: 'Educational', surface: 'social',
    style: 'clean-light', aspect: 'square', accent: '#2563eb', coBrand: false,
    fields: [
      f('eyebrow', 'Eyebrow', 'MARKET INSIGHT'),
      f('headline', 'Headline', 'What Buyers Should Know This Week'),
      f('subheadline', 'Subheadline', 'A quick read for movers'),
      f('body', 'Body', 'Markets shift fast. Here’s what it means for your home-buying plans — without the jargon.', true),
      f('cta', 'Call to action', 'DM me your questions'),
    ],
  },
  {
    id: 'ftb-tip', name: 'First-Time Buyer Tip', category: 'Educational', surface: 'social',
    style: 'bold-gradient', aspect: 'square', accent: '#0f766e', coBrand: false,
    fields: [
      f('eyebrow', 'Eyebrow', 'FIRST-TIME BUYER TIP'),
      f('headline', 'Headline', 'You May Need Less Down Than You Think'),
      f('subheadline', 'Subheadline', 'Myth-busting homeownership'),
      f('body', 'Body', 'Low-down-payment programs exist for a reason. Let’s find the one that fits you.', true),
      f('cta', 'Call to action', 'Save this & send me a message'),
    ],
  },
  {
    id: 'client-win', name: 'Client Win', category: 'Wins', surface: 'social',
    style: 'dark-luxe', aspect: 'story', accent: '#C9A95C', coBrand: false,
    fields: [
      f('eyebrow', 'Eyebrow', 'CLIENT WIN'),
      f('headline', 'Headline', 'Keys in Hand 🔑'),
      f('subheadline', 'Subheadline', 'Closed on time, stress-free'),
      f('body', 'Body', 'Every closing is personal. Ready to write your story? I’m here for it.', true),
      f('cta', 'Call to action', 'Let’s get you home'),
    ],
  },
  {
    id: 'quote-card', name: 'Motivational Quote', category: 'Engagement', surface: 'social',
    style: 'editorial', aspect: 'square', accent: '#7c3aed', coBrand: false,
    fields: [
      f('eyebrow', 'Eyebrow', ''),
      f('headline', 'Quote', '“Owning a home is a keystone of wealth.”'),
      f('subheadline', 'Attribution', '— Suze Orman'),
      f('body', 'Body', 'Let’s build yours. Reach out whenever you’re ready to explore.', true),
      f('cta', 'Call to action', 'Follow for more'),
    ],
  },
];

export function templatesForSurface(surface: StudioTemplate['surface']): StudioTemplate[] {
  return STUDIO_TEMPLATES.filter((t) => t.surface === surface);
}
