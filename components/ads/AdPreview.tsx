'use client';

/**
 * Realistic visual previews of an ad creative — so copy in the builder/library
 * looks and feels like a real placed ad rather than plain text.
 *   • Meta  → Facebook feed card (avatar, creative image, headline bar, CTA)
 *   • Google → search result ad (Ad label, display URL, blue headline, desc)
 *
 * Pure presentational. The "creative image" is a branded gradient block with the
 * headline overlaid (we don't generate imagery), which reads like a designed ad.
 */
import { useState } from 'react';
import { Globe, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';

export interface AdPreviewCreative {
  ad_type: string;
  platform: string; // 'meta' | 'google' | 'both'
  headline: string;
  primary_text?: string | null;
  description?: string | null;
  cta_type?: string | null;
  nmls_number?: string | null;
  accent?: string;
}

export const ACCENT_BY_TYPE: Record<string, string> = {
  purchase: '#2563EB',
  refinance: '#16A34A',
  fha: '#B8860B',
  va: '#4338CA',
  heloc: '#EA580C',
  coop: '#1877F2',
};

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  refinance: 'Refinance',
  fha: 'FHA Loan',
  va: 'VA Loan',
  heloc: 'HELOC',
  coop: 'Co-Marketing',
};

function accentOf(c: AdPreviewCreative): string {
  return c.accent || ACCENT_BY_TYPE[c.ad_type] || '#2563EB';
}

function domainOf(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 22) || 'yourcompany';
  return `${slug}.com`;
}

/** Branded gradient "creative image" with the headline overlaid. */
export function AdCreativeImage({
  creative,
  height = 240,
}: {
  creative: AdPreviewCreative;
  height?: number;
}) {
  const accent = accentOf(creative);
  return (
    <div
      className="relative w-full overflow-hidden flex items-end"
      style={{
        height,
        background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 55%, rgba(0,0,0,0.55) 100%)`,
      }}
    >
      <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider text-white/90 bg-black/25 backdrop-blur-sm px-2 py-0.5 rounded-full">
        {TYPE_LABEL[creative.ad_type] ?? creative.ad_type}
      </span>
      <div className="relative p-4 w-full">
        <p
          className="text-white font-extrabold leading-tight"
          style={{ fontSize: height < 180 ? 17 : 24, textShadow: '0 1px 12px rgba(0,0,0,0.35)' }}
        >
          {creative.headline || 'Your headline here'}
        </p>
      </div>
    </div>
  );
}

function MetaCard({ creative, company }: { creative: AdPreviewCreative; company: string }) {
  const accent = accentOf(creative);
  const initial = (company.trim()[0] ?? 'A').toUpperCase();
  return (
    <div className="w-full max-w-[380px] bg-white rounded-xl border border-black/[0.08] shadow-sm overflow-hidden font-sans">
      {/* header */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
          style={{ background: accent }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#050505] truncate">{company}</p>
          <p className="text-[11px] text-[#65676b] flex items-center gap-1">
            Sponsored · <Globe size={10} />
          </p>
        </div>
      </div>
      {/* primary text */}
      {creative.primary_text && (
        <p className="text-[13px] text-[#050505] px-3 py-2 leading-snug whitespace-pre-wrap line-clamp-4">
          {creative.primary_text}
        </p>
      )}
      {/* creative image */}
      <AdCreativeImage creative={creative} height={210} />
      {/* link bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f0f2f5]">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase text-[#65676b] tracking-wide truncate">{domainOf(company)}</p>
          <p className="text-[13px] font-semibold text-[#050505] leading-tight truncate">{creative.headline}</p>
          {creative.description && (
            <p className="text-[11px] text-[#65676b] truncate">{creative.description}</p>
          )}
        </div>
        {creative.cta_type && (
          <button
            type="button"
            className="flex-shrink-0 text-[13px] font-semibold text-[#050505] bg-[#e4e6eb] hover:bg-[#d8dadf] rounded-md px-3 py-1.5"
          >
            {creative.cta_type}
          </button>
        )}
      </div>
      {/* engagement row (decorative) */}
      <div className="flex items-center justify-around px-3 py-1.5 border-t border-black/[0.06] text-[#65676b]">
        <span className="flex items-center gap-1.5 text-[12px] font-medium"><ThumbsUp size={14} /> Like</span>
        <span className="flex items-center gap-1.5 text-[12px] font-medium"><MessageCircle size={14} /> Comment</span>
        <span className="flex items-center gap-1.5 text-[12px] font-medium"><Share2 size={14} /> Share</span>
      </div>
      <Disclosure creative={creative} />
    </div>
  );
}

function GoogleCard({ creative, company }: { creative: AdPreviewCreative; company: string }) {
  return (
    <div className="w-full max-w-[440px] bg-white rounded-xl border border-black/[0.08] shadow-sm p-4 font-sans">
      <div className="flex items-center gap-1.5 text-[12px] text-[#202124]">
        <span className="font-bold">Ad</span>
        <span className="text-[#5f6368]">·</span>
        <span className="text-[#5f6368] truncate">{domainOf(company)}</span>
      </div>
      <p className="text-[19px] text-[#1a0dab] leading-snug mt-1.5 hover:underline cursor-pointer">
        {creative.headline || 'Your headline here'}
      </p>
      <p className="text-[13px] text-[#4d5156] leading-snug mt-1">
        {[creative.primary_text, creative.description].filter(Boolean).join(' ')}
      </p>
      <Disclosure creative={creative} dense />
    </div>
  );
}

function Disclosure({ creative, dense }: { creative: AdPreviewCreative; dense?: boolean }) {
  return (
    <p className={`text-[10px] text-[#8a8d91] px-3 ${dense ? 'pt-2' : 'py-2'}`}>
      {creative.nmls_number ? `NMLS #${creative.nmls_number} · ` : ''}Equal Housing Opportunity
    </p>
  );
}

export function AdPreview({
  creative,
  companyName,
  surface,
  showSurfaceToggle = true,
}: {
  creative: AdPreviewCreative;
  companyName: string;
  surface?: 'meta' | 'google';
  showSurfaceToggle?: boolean;
}) {
  const derived: 'meta' | 'google' = creative.platform === 'google' ? 'google' : 'meta';
  const [active, setActive] = useState<'meta' | 'google'>(surface ?? derived);
  const canToggle = showSurfaceToggle && !surface && creative.platform === 'both';
  const shown = surface ?? (creative.platform === 'both' ? active : derived);

  return (
    <div className="flex flex-col items-center gap-3">
      {canToggle && (
        <div className="flex items-center gap-1 bg-[rgba(60,60,67,0.06)] rounded-full p-0.5">
          {(['meta', 'google'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              className={`text-[11px] font-medium px-3 py-1 rounded-full transition-colors ${
                active === s ? 'bg-white shadow-sm text-[#050505]' : 'text-[#65676b]'
              }`}
            >
              {s === 'meta' ? 'Meta' : 'Google'}
            </button>
          ))}
        </div>
      )}
      {shown === 'google' ? (
        <GoogleCard creative={creative} company={companyName} />
      ) : (
        <MetaCard creative={creative} company={companyName} />
      )}
    </div>
  );
}
