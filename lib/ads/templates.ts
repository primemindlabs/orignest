/**
 * Curated, compliance-safe ad creative templates.
 *
 * These ship with the app so the Creative Library is useful immediately —
 * before an LO has generated anything. Copy is intentionally free of rate, APR,
 * payment, or "guaranteed" claims; Equal Housing + NMLS are rendered by the
 * preview/footer at export time. Co-marketing copy uses [Agent] as a merge token.
 *
 * Pure data — safe to import in client and server components.
 */
import type { AdType, AdPlatform } from '@/lib/ai/adCreative';

export interface AdTemplate {
  id: string; // stable slug
  name: string; // library display name
  ad_type: AdType;
  platform: Extract<AdPlatform, 'meta' | 'google'>; // each template is tuned to one surface
  category: string; // grouping for the library
  headline: string;
  primary_text: string;
  description: string;
  cta_type: string;
  /** accent used for the preview "creative" gradient */
  accent: string;
  tags: string[];
}

export const AD_TEMPLATES: AdTemplate[] = [
  // ── Purchase ──────────────────────────────────────────────────────────────
  {
    id: 'purchase-first-time-meta',
    name: 'First-Time Buyer — Friendly',
    ad_type: 'purchase',
    platform: 'meta',
    category: 'Purchase',
    headline: "Buying your first home? Let's make it simple.",
    primary_text:
      "Navigating your first mortgage shouldn't feel overwhelming. We'll walk you through every step — from pre-approval to keys in hand — and answer every question along the way.",
    description: 'Personalized guidance for first-time buyers.',
    cta_type: 'Get Pre-Approved',
    accent: '#2563EB',
    tags: ['first-time', 'pre-approval'],
  },
  {
    id: 'purchase-preapproval-google',
    name: 'Purchase — Search Intent',
    ad_type: 'purchase',
    platform: 'google',
    category: 'Purchase',
    headline: 'Get Pre-Approved to Buy a Home',
    primary_text: 'Know your budget before you shop.',
    description:
      'Fast, friendly pre-approvals from a local loan officer. Start your homebuying journey today.',
    cta_type: 'Apply Now',
    accent: '#2563EB',
    tags: ['pre-approval', 'purchase'],
  },
  {
    id: 'purchase-new-construction-meta',
    name: 'New Construction',
    ad_type: 'purchase',
    platform: 'meta',
    category: 'Purchase',
    headline: 'Considering a newly built home?',
    primary_text:
      "Financing new construction has its own timeline and details. We'll help you understand your options and line up financing that fits your build — so you can focus on picking finishes, not paperwork.",
    description: 'Guidance for new-construction financing.',
    cta_type: 'Learn More',
    accent: '#0EA5E9',
    tags: ['new-construction', 'purchase'],
  },

  // ── Refinance ─────────────────────────────────────────────────────────────
  {
    id: 'refinance-goals-meta',
    name: 'Refinance — Your Goals',
    ad_type: 'refinance',
    platform: 'meta',
    category: 'Refinance',
    headline: 'Could refinancing work for you?',
    primary_text:
      "If your situation has changed, refinancing may help you reach your goals — whether that's adjusting your term or accessing equity. Let's review your options together, no pressure.",
    description: 'See if refinancing fits your goals.',
    cta_type: 'Learn More',
    accent: '#16A34A',
    tags: ['refinance', 'review'],
  },
  {
    id: 'refinance-review-google',
    name: 'Refinance — Free Review',
    ad_type: 'refinance',
    platform: 'google',
    category: 'Refinance',
    headline: 'Refinance Your Mortgage',
    primary_text: 'Explore options that fit your goals.',
    description:
      'Talk through your refinance options with a local loan officer. Free, no-obligation review.',
    cta_type: 'Get a Quote',
    accent: '#16A34A',
    tags: ['refinance', 'quote'],
  },
  {
    id: 'refinance-cashout-meta',
    name: 'Cash-Out — Tap Equity',
    ad_type: 'refinance',
    platform: 'meta',
    category: 'Refinance',
    headline: "Put the equity you've built to work.",
    primary_text:
      'A cash-out refinance can help you fund a renovation, consolidate higher-cost debt, or reach other goals using your home equity. Let’s see whether the numbers make sense for you.',
    description: 'Use your equity with a cash-out refinance.',
    cta_type: 'Learn More',
    accent: '#15803D',
    tags: ['cash-out', 'equity'],
  },

  // ── FHA ───────────────────────────────────────────────────────────────────
  {
    id: 'fha-low-down-meta',
    name: 'FHA — Low Down Payment',
    ad_type: 'fha',
    platform: 'meta',
    category: 'FHA',
    headline: 'A lower down payment may be within reach.',
    primary_text:
      "FHA loans are designed to help more buyers achieve homeownership, with flexible qualifying guidelines. Let's see if an FHA loan is the right fit for your situation.",
    description: 'Flexible guidelines for qualified buyers.',
    cta_type: 'Get Pre-Approved',
    accent: '#B8860B',
    tags: ['fha', 'low-down'],
  },
  {
    id: 'fha-google',
    name: 'FHA — Search Intent',
    ad_type: 'fha',
    platform: 'google',
    category: 'FHA',
    headline: 'FHA Home Loans — Get Started',
    primary_text: 'Lower down payment options for qualified buyers.',
    description: 'Speak with a local loan officer about FHA programs and eligibility today.',
    cta_type: 'Apply Now',
    accent: '#B8860B',
    tags: ['fha'],
  },

  // ── VA ────────────────────────────────────────────────────────────────────
  {
    id: 'va-thank-you-meta',
    name: 'VA — Thank You for Serving',
    ad_type: 'va',
    platform: 'meta',
    category: 'VA',
    headline: 'Veterans: your service may open doors.',
    primary_text:
      'VA loans offer eligible Veterans and service members a path to homeownership with unique benefits. Thank you for your service — let us help you put your benefits to work.',
    description: 'Exclusive benefits for eligible Veterans.',
    cta_type: 'Learn More',
    accent: '#4338CA',
    tags: ['va', 'veterans'],
  },
  {
    id: 'va-google',
    name: 'VA — Search Intent',
    ad_type: 'va',
    platform: 'google',
    category: 'VA',
    headline: 'VA Home Loans for Veterans',
    primary_text: 'Eligible Veterans and service members may qualify for unique benefits.',
    description: 'Connect with a VA-savvy loan officer to review your eligibility.',
    cta_type: 'Get Started',
    accent: '#4338CA',
    tags: ['va', 'veterans'],
  },

  // ── HELOC ─────────────────────────────────────────────────────────────────
  {
    id: 'heloc-flexible-meta',
    name: 'HELOC — Flexible Access',
    ad_type: 'heloc',
    platform: 'meta',
    category: 'HELOC',
    headline: "Your home's equity could be working for you.",
    primary_text:
      "From renovations to consolidating expenses, a home equity line of credit gives you flexible access to the value you've built. Let's explore what's possible for your home.",
    description: "Flexible access to your home's equity.",
    cta_type: 'Learn More',
    accent: '#EA580C',
    tags: ['heloc', 'equity'],
  },
  {
    id: 'heloc-google',
    name: 'HELOC — Search Intent',
    ad_type: 'heloc',
    platform: 'google',
    category: 'HELOC',
    headline: 'Home Equity Line of Credit',
    primary_text: "Put your home's equity to work for renovations and more.",
    description: 'Talk to a local expert about home equity options that fit your plans.',
    cta_type: 'Get a Quote',
    accent: '#EA580C',
    tags: ['heloc', 'equity'],
  },

  // ── Co-Marketing (with a realtor partner) ─────────────────────────────────
  {
    id: 'coop-team-meta',
    name: 'Co-Marketing — A Team With Your Back',
    ad_type: 'coop',
    platform: 'meta',
    category: 'Co-Marketing',
    headline: 'Find your next home with a team that has your back.',
    primary_text:
      'Working together, [Agent] and our lending team make buying smoother — from your first showing to closing day. Let’s find the right home and the right financing for you.',
    description: 'A trusted agent + lender team.',
    cta_type: 'Contact Us',
    accent: '#1877F2',
    tags: ['co-marketing', 'realtor'],
  },
  {
    id: 'coop-openhouse-google',
    name: 'Co-Marketing — Open House',
    ad_type: 'coop',
    platform: 'google',
    category: 'Co-Marketing',
    headline: 'Buy With a Trusted Local Team',
    primary_text: 'An experienced agent and loan officer, working together for you.',
    description: 'Reach out to [Agent] and our lending team to start your home search today.',
    cta_type: 'Contact Us',
    accent: '#1877F2',
    tags: ['co-marketing', 'open-house'],
  },
];

export function getAdTemplate(id: string): AdTemplate | undefined {
  return AD_TEMPLATES.find((t) => t.id === id);
}

/** Distinct category list in template order, for filter chips. */
export const AD_TEMPLATE_CATEGORIES = Array.from(
  new Set(AD_TEMPLATES.map((t) => t.category)),
);
