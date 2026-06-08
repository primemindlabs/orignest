import { cn } from '@/lib/utils';

/**
 * The single source of truth for the Ashley AI brand mark. Use this everywhere
 * a logo appears (sidebar, auth pages, onboarding, portals, emails) so the icon,
 * wordmark, and spacing stay pixel-consistent across the product.
 *
 *   <Logo />                      full lockup (icon + wordmark + tagline)
 *   <Logo variant="wordmark" />   icon + wordmark, no tagline
 *   <Logo variant="icon" />       just the icon (favicons, avatars, tight spots)
 *   <Logo theme="dark" />         white wordmark for dark backgrounds
 */
type LogoProps = {
  variant?: 'full' | 'wordmark' | 'icon';
  theme?: 'light' | 'dark';
  size?: number; // icon edge length in px
  className?: string;
};

export function LogoIcon({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-[28%] bg-gray-900 shadow-sm',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stylized "A" / rooftop peak — ties the mark to mortgages/home */}
        <path
          d="M12 3.5 L20 20 H15.4 L12 12.2 L8.6 20 H4 L12 3.5 Z"
          fill="white"
        />
        {/* Crossbar */}
        <rect x="9" y="15.1" width="6" height="2.1" rx="1.05" fill="white" />
      </svg>
      {/* Sparkle accent */}
      <svg
        width={size * 0.34}
        height={size * 0.34}
        viewBox="0 0 12 12"
        fill="none"
        className="absolute"
        style={{ top: -size * 0.06, right: -size * 0.06 }}
      >
        <path
          d="M6 0 C6.4 2.8 3.2 6 0.4 6 C3.2 6 6 8.8 6 12 C6 8.8 8.8 6 11.6 6 C8.8 6 6 2.8 6 0 Z"
          fill="#C9A95C"
        />
      </svg>
    </span>
  );
}

export function Logo({ variant = 'full', theme = 'light', size = 36, className }: LogoProps) {
  if (variant === 'icon') return <LogoIcon size={size} className={className} />;

  const titleColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const tagColor = theme === 'dark' ? 'text-white/60' : 'text-gray-400';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoIcon size={size} />
      <span className="flex flex-col leading-none">
        <span
          className={cn('font-bold tracking-tight', titleColor)}
          style={{ fontSize: size * 0.4 }}
        >
          Ashley<span className="text-gold">IQ</span>
        </span>
        {variant === 'full' && (
          <span className={cn('mt-0.5', tagColor)} style={{ fontSize: size * 0.28 }}>
            Your AI Mortgage Assistant
          </span>
        )}
      </span>
    </span>
  );
}
