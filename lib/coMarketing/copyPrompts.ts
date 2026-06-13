// Phase 118 — co-marketing copy prompts + material catalog. PURE.
// Compliance: no specific rates/terms; rate graphics explicitly forbid rate numbers.
// The NMLS disclaimer is appended server-side (see the generate route) — never here,
// never removable by the LO.

export type MaterialType =
  | 'open_house_flyer'
  | 'buyer_guide'
  | 'social_post_instagram'
  | 'social_post_linkedin'
  | 'email_header'
  | 'listing_flyer'
  | 'rate_update_graphic';

export const MATERIAL_TYPES: { id: MaterialType; label: string; desc: string; size: string; needsRealtor?: boolean; needsProperty?: boolean }[] = [
  { id: 'open_house_flyer', label: 'Open House Flyer', desc: 'Print/email for open house events', size: '8.5×11', needsRealtor: true, needsProperty: true },
  { id: 'listing_flyer', label: 'Listing Flyer', desc: 'Property + financing info', size: '8.5×11', needsRealtor: true, needsProperty: true },
  { id: 'buyer_guide', label: 'Buyer Guide', desc: 'First-time buyer lead magnet', size: 'Letter PDF' },
  { id: 'social_post_instagram', label: 'Instagram Post', desc: 'Partnership / rate updates', size: '1080×1080' },
  { id: 'social_post_linkedin', label: 'LinkedIn Post', desc: 'Professional network content', size: '1200×627' },
  { id: 'email_header', label: 'Email Header', desc: 'Co-branded email campaigns', size: '600×200', needsRealtor: true },
  { id: 'rate_update_graphic', label: 'Rate Update Graphic', desc: 'Weekly market update', size: '1080×1080' },
];

export interface CopyContext {
  loName: string;
  loNmls: string | null;
  realtorName?: string | null;
  brokerage?: string | null;
  propertyAddress?: string | null;
  openHouseDate?: string | null;
  customMessage?: string | null;
}

const BASE =
  "You are writing copy for a mortgage professional's co-marketing material. Be professional, warm, and compliance-friendly. Never promise or mention specific rates, APRs, or terms. Keep it under 100 words. Return only the copy — no preamble, no quotes.";

export function buildCopyPrompt(type: MaterialType, c: CopyContext): string {
  const lo = `LO: ${c.loName}${c.loNmls ? `, NMLS #${c.loNmls}` : ''}.`;
  const realtor = c.realtorName ? `Realtor: ${c.realtorName}${c.brokerage ? ` at ${c.brokerage}` : ''}.` : '';

  switch (type) {
    case 'open_house_flyer':
    case 'listing_flyer':
      return `${BASE} Write short copy for a ${type.replace(/_/g, ' ')}. ${lo} ${realtor} Property: ${c.propertyAddress ?? 'this home'}.${c.openHouseDate ? ` Open house: ${c.openHouseDate}.` : ''} Include a warm call to action to get pre-approved.`;
    case 'rate_update_graphic':
      return `${BASE} Write copy for a weekly market-update social post. ${lo} Custom note from the LO: ${c.customMessage ?? 'The market is moving — a quick conversation can help you plan your next move.'} IMPORTANT: do NOT mention any specific rate, APR, or number.`;
    case 'buyer_guide':
      return `${BASE} Write a headline and a 3-line subheader for a first-time buyer guide. Helpful and empowering, not salesy. ${lo}`;
    case 'social_post_instagram':
    case 'social_post_linkedin':
      return `${BASE} Write a ${type.includes('linkedin') ? 'LinkedIn' : 'Instagram'} post. ${lo} ${realtor} ${c.customMessage ? `Theme: ${c.customMessage}.` : 'Theme: the value of working with a trusted lender + agent team.'}`;
    case 'email_header':
      return `${BASE} Write a one-line co-branded email header tagline. ${lo} ${realtor}`;
    default:
      return `${BASE} Create marketing copy for ${type}. ${lo} ${realtor}`;
  }
}

/** Server-appended NMLS disclaimer — never omittable. */
export function nmlsDisclaimer(loName: string, nmls: string | null, company?: string | null): string {
  return `${loName}${nmls ? `, NMLS #${nmls}` : ''}${company ? ` · ${company}` : ''}. This is not a commitment to lend or an offer of credit. Equal Housing Lender.`;
}
