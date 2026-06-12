/**
 * Phase 95 — heat band pill. Hot uses the gold accent; others use restrained
 * tints so the badge reads as a status, not page chrome.
 */
const BAND_STYLES: Record<string, string> = {
  hot: 'text-[#8A6310] bg-[#F5EFE0] border-[#C9A95C]',
  warm: 'text-[#1a7a3c] bg-[#edf7f0] border-[#1a7a3c]/40',
  cooling: 'text-[#b85c20] bg-[#fdf0ea] border-[#C4724A]/40',
  cold: 'text-[#86868B] bg-[#F2F2F2] border-[#D6D6D6]',
};

const LABEL: Record<string, string> = { hot: 'Hot', warm: 'Warm', cooling: 'Cooling', cold: 'Cold' };

export function HeatBandBadge({ band, className = '' }: { band: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${BAND_STYLES[band] ?? BAND_STYLES.cold} ${className}`}
    >
      {LABEL[band] ?? 'Cold'}
    </span>
  );
}
