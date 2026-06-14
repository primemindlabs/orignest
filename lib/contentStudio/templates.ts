/**
 * Phase 132 — compliant-by-construction fallback posts (used when no API key, or when
 * the model output can't pass compliance). No rates/$/guarantees/client names.
 */
import type { Platform } from './types';

export interface TemplateCtx {
  loName: string;
  market: string;
  rateContext: string; // e.g. "rates are in the low-to-mid 6s this week"
  focusTopic?: string;
  recentCloseType?: string;
}

export interface TemplateOut {
  post_text: string;
  hashtags: string;
  image_prompt: string;
}

const HASHTAGS: Record<Platform, string> = {
  linkedin: '#MortgageTips #HomeBuying #RealEstate #FirstTimeHomeBuyer',
  instagram: '#HomeBuying #MortgageTips #HomeGoals #RealEstate #DreamHome',
  facebook: '#HomeBuying #Mortgage #FirstTimeHomeBuyer #LocalRealEstate',
};

export function templateFor(contentType: string, platform: Platform, ctx: TemplateCtx): TemplateOut {
  const tags = HASHTAGS[platform];
  switch (contentType) {
    case 'market_insight':
      return {
        post_text: `A lot of buyers in ${ctx.market} are asking me the same question right now: "Should I wait?" Here's what I tell them — the right time to buy is less about timing the market and more about your own readiness. ${ctx.rateContext}, and the buyers who win are the ones who are prepared: pre-approved, clear on their budget, and ready to move when the right home shows up. Happy to walk you through where you stand. — ${ctx.loName}`,
        hashtags: tags,
        image_prompt: `Clean, professional graphic with the ${ctx.market} skyline and a "Market Update" header in warm neutral tones`,
      };
    case 'quick_tip':
      return {
        post_text: `3 things that can quietly delay your closing 👇\n1. Big purchases before closing (hold off on that new car!)\n2. Switching jobs mid-process\n3. Slow document turnaround\nThe fix? Stay in touch with your loan officer and send things over fast. Questions? I'm here. — ${ctx.loName}`,
        hashtags: tags,
        image_prompt: 'Simple checklist-style graphic, three numbered tips, soft neutral background',
      };
    case 'community_education':
      return {
        post_text: `First-time buyer in ${ctx.market}? Here's something most people don't realize: you may have more options than you think. From low-down-payment programs to down-payment assistance, there are paths to homeownership that don't require 20% down. The first step is just a conversation — no pressure, no obligation. — ${ctx.loName}`,
        hashtags: tags,
        image_prompt: 'Warm, welcoming photo of a front porch with a "First-Time Buyer Guide" caption',
      };
    case 'anonymized_win':
      return {
        post_text: `One of my favorite parts of this job: helping people find a path that actually fits. Recently I worked with a buyer who assumed homeownership was out of reach${ctx.recentCloseType ? ` — a ${ctx.recentCloseType} loan turned out to be the right fit` : ''}. We took it step by step, and the look on their face at closing said it all. If you've been told "no" before, it might be worth a second look. — ${ctx.loName}`,
        hashtags: HASHTAGS[platform],
        image_prompt: 'Keys being handed over at a closing table, warm natural light',
      };
    case 'behind_the_scenes':
      return {
        post_text: `Ever wonder what a loan officer actually does all day? 🏡 A big part of it is translating — turning a maze of paperwork, programs, and guidelines into a plan that makes sense for YOU. I spend my days advocating for my clients behind the scenes so closing day feels like a celebration, not a surprise. That's the job, and I love it. — ${ctx.loName}`,
        hashtags: HASHTAGS[platform],
        image_prompt: 'Candid desk flat-lay: laptop, coffee, notepad — approachable and human',
      };
    case 'rate_environment':
      return {
        post_text: `This week in ${ctx.market}: ${ctx.rateContext}. The headline number matters less than what it means for YOUR plan — your timeline, your budget, your goals. If you're wondering how today's market affects your buying power, let's run your specific numbers together. — ${ctx.loName}`,
        hashtags: HASHTAGS[platform],
        image_prompt: 'Minimal "Weekly Rate Update" graphic with abstract upward chart motif',
      };
    case 'aspirational':
    default:
      return {
        post_text: `Homeownership starts with one conversation. 🔑 Not a credit pull, not a pile of paperwork — just a conversation about where you want to be and how to get there. Whenever you're ready, I'm here to help you take that first step. — ${ctx.loName}`,
        hashtags: HASHTAGS[platform],
        image_prompt: 'Aspirational sunrise over a quiet neighborhood, hopeful and bright',
      };
  }
}
