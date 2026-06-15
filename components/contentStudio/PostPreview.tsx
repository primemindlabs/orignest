'use client';

/**
 * Designed, "Canva-feel" visual preview of a generated social post. Renders the
 * post as a branded graphic (per content-type template) plus a feed-style caption,
 * so the studio output looks designed rather than like raw text.
 */
import { IconBrandLinkedin, IconBrandInstagram, IconBrandFacebook } from '@tabler/icons-react';
import type { ContentPostRow, Platform } from '@/lib/contentStudio/types';
import { cleanPostText } from '@/lib/contentStudio/sanitizePost';

const PLATFORM_ICON: Record<Platform, typeof IconBrandLinkedin> = {
  linkedin: IconBrandLinkedin,
  instagram: IconBrandInstagram,
  facebook: IconBrandFacebook,
};

// Per content-type template: gradient, accent, eyebrow label.
interface Theme { from: string; to: string; accent: string; ink: string; eyebrow: string }
const THEMES: Record<string, Theme> = {
  market_insight:      { from: '#10243F', to: '#1E3A5F', accent: '#C9A95C', ink: '#FFFFFF', eyebrow: 'Market Insight' },
  quick_tip:           { from: '#C9A95C', to: '#9A7B2E', accent: '#10243F', ink: '#1A1407', eyebrow: 'Quick Tip' },
  community_education:  { from: '#0E5A4A', to: '#11876B', accent: '#FBE7B2', ink: '#FFFFFF', eyebrow: 'Did You Know' },
  anonymized_win:      { from: '#0F7A45', to: '#1AA85C', accent: '#FFFFFF', ink: '#FFFFFF', eyebrow: 'Closed & Funded' },
  behind_the_scenes:   { from: '#2A2F3A', to: '#454C5C', accent: '#C9A95C', ink: '#FFFFFF', eyebrow: 'Behind the Scenes' },
  rate_environment:    { from: '#332B66', to: '#4B3F99', accent: '#C9A95C', ink: '#FFFFFF', eyebrow: 'Rate Watch' },
  aspirational:        { from: '#B5552F', to: '#E0884A', accent: '#FFF1DD', ink: '#FFFFFF', eyebrow: 'Your Next Chapter' },
};
const DEFAULT_THEME: Theme = { from: '#10243F', to: '#1E3A5F', accent: '#C9A95C', ink: '#FFFFFF', eyebrow: 'Featured' };

/** Pull a short, punchy headline out of the post body for the graphic. */
function deriveHeadline(text: string): string {
  const firstSentence = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? text;
  const h = firstSentence.replace(/^[^A-Za-z0-9"']+/, '').trim();
  return h.length > 90 ? h.slice(0, 88).trimEnd() + '…' : h;
}

function brandFromFooter(footer: string): { name: string; initials: string } {
  // Footer is typically "Name · NMLS #… · Company" — take the leading name.
  const name = (footer.split('·')[0] ?? '').trim() || 'Your Brokerage';
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'AI';
  return { name, initials };
}

export function PostPreview({ post }: { post: ContentPostRow }) {
  const text = cleanPostText(post.edited_text ?? post.post_text);
  const theme = THEMES[post.content_type] ?? DEFAULT_THEME;
  const headline = deriveHeadline(text);
  const Icon = PLATFORM_ICON[post.platform];
  const { name, initials } = brandFromFooter(post.nmls_footer);

  return (
    <div className="rounded-xl overflow-hidden border border-[#E8E4DE] bg-white">
      {/* Designed graphic */}
      <div
        className="relative aspect-square p-5 flex flex-col"
        style={{ background: `linear-gradient(145deg, ${theme.from} 0%, ${theme.to} 100%)` }}
      >
        {/* decorative shapes */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20" style={{ background: theme.accent }} />
        <div className="absolute right-6 bottom-20 w-16 h-16 rounded-full opacity-10" style={{ background: theme.accent }} />

        {/* brand row */}
        <div className="relative flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: theme.accent, color: theme.from }}>{initials}</div>
          <span className="text-[12px] font-semibold tracking-wide" style={{ color: theme.ink }}>{name}</span>
          <Icon size={15} className="ml-auto opacity-80" style={{ color: theme.ink }} />
        </div>

        {/* eyebrow + headline */}
        <div className="relative mt-auto">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full mb-2.5" style={{ background: theme.accent, color: theme.from }}>{theme.eyebrow}</span>
          <p className="text-[22px] leading-[1.18] font-bold" style={{ color: theme.ink }}>{headline}</p>
        </div>

        {/* accent rule */}
        <div className="relative mt-3 h-1 w-12 rounded-full" style={{ background: theme.accent }} />
      </div>

      {/* Feed-style caption */}
      <div className="px-4 py-3">
        <p className="text-[13px] text-[#1A1A1A] whitespace-pre-wrap leading-relaxed line-clamp-4">{text}</p>
        {post.hashtags && <p className="text-[12px] text-[#876830] mt-1.5 line-clamp-1">{post.hashtags}</p>}
      </div>
    </div>
  );
}
