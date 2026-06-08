'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The single source of truth for the Ashley character portrait — the face of the
 * AshleyIQ brand. Use this everywhere a "character" appears (Ask Ashley widget,
 * sign-in / sign-up hero, onboarding, landing hero) so it's the same image
 * everywhere.
 *
 * Drop the portrait at: public/ashley-character.png
 * (any square image works; it's rendered as a centered circle).
 *
 * Until that file exists the component shows a tasteful navy/gold monogram so the
 * UI never looks broken.
 */
export function AshleyAvatar({
  size = 40,
  ring = false,
  className,
}: {
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const ringCls = ring ? 'ring-2 ring-gold/50 ring-offset-2 ring-offset-transparent' : '';

  if (failed) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-navy text-gold font-bold select-none',
          ringCls,
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-label="Ashley"
      >
        A
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ashley-character.png"
      alt="Ashley — your AI mortgage assistant"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('rounded-full object-cover', ringCls, className)}
      style={{ width: size, height: size }}
    />
  );
}
