'use client';

import { clsx } from 'clsx';

interface EmptyStateProps {
  icon?: React.ReactNode;
  illustration?: 'leads' | 'tasks' | 'inbox' | 'pipeline' | 'done';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function IllustrationSVG({ type }: { type: NonNullable<EmptyStateProps['illustration']> }) {
  const illustrations = {
    leads: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="16" width="48" height="36" rx="6" fill="rgba(0,122,255,0.06)" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5"/>
        <circle cx="26" cy="28" r="6" fill="rgba(0,122,255,0.12)" stroke="rgba(0,122,255,0.2)" strokeWidth="1.5"/>
        <path d="M16 44c0-5.523 4.477-10 10-10h0c5.523 0 10 4.477 10 10" stroke="rgba(0,122,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M38 30h8M38 35h6" stroke="rgba(0,122,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="52" cy="48" r="7" fill="rgba(52,199,89,0.15)" stroke="rgba(52,199,89,0.3)" strokeWidth="1.5"/>
        <path d="M49 48l2 2 4-4" stroke="rgba(52,199,89,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    tasks: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="10" width="40" height="44" rx="6" fill="rgba(0,122,255,0.06)" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5"/>
        <path d="M22 24h20M22 32h20M22 40h12" stroke="rgba(0,122,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="18" cy="24" r="2" fill="rgba(0,122,255,0.3)"/>
        <circle cx="18" cy="32" r="2" fill="rgba(0,122,255,0.3)"/>
        <circle cx="18" cy="40" r="2" fill="rgba(174,174,178,0.4)"/>
      </svg>
    ),
    inbox: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="14" width="48" height="36" rx="6" fill="rgba(0,122,255,0.06)" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5"/>
        <path d="M8 20l24 16 24-16" stroke="rgba(0,122,255,0.2)" strokeWidth="1.5"/>
        <circle cx="48" cy="20" r="8" fill="rgba(52,199,89,0.15)" stroke="rgba(52,199,89,0.3)" strokeWidth="1.5"/>
        <path d="M45 20l2 2 4-4" stroke="rgba(52,199,89,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    pipeline: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="14" height="48" rx="4" fill="rgba(0,122,255,0.06)" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5"/>
        <rect x="26" y="16" width="14" height="40" rx="4" fill="rgba(0,122,255,0.06)" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5"/>
        <rect x="44" y="24" width="12" height="32" rx="4" fill="rgba(0,122,255,0.06)" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5"/>
        <path d="M15 52V28M33 52V36M50 52V44" stroke="rgba(0,122,255,0.15)" strokeWidth="1.5" strokeDasharray="3 3"/>
      </svg>
    ),
    done: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="24" fill="rgba(52,199,89,0.08)" stroke="rgba(52,199,89,0.2)" strokeWidth="1.5"/>
        <path d="M20 32l8 8 16-16" stroke="rgba(52,199,89,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 18c2-4 6-6 10-4M54 18c-2-4-6-6-10-4M10 46c2 4 6 6 10 4M54 46c-2 4-6 6-10 4" stroke="rgba(52,199,89,0.2)" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  };
  return illustrations[type] ?? null;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  size = 'md',
  className,
}: EmptyStateProps) {
  const paddingClass = { sm: 'py-8', md: 'py-12', lg: 'py-16' }[size];

  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', paddingClass, className)}>
      {/* Illustration or custom icon */}
      {illustration ? (
        <div className="mb-4 opacity-80">
          <IllustrationSVG type={illustration} />
        </div>
      ) : icon ? (
        <div className="mb-4 text-[#AEAEB2]">{icon}</div>
      ) : null}

      <p className={clsx('font-semibold text-black', size === 'sm' ? 'text-sm' : 'text-[15px]')}>
        {title}
      </p>

      {description && (
        <p className={clsx('mt-1 text-[#6C6C70] max-w-xs leading-relaxed', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}

      {(actionLabel && (onAction || actionHref)) && (
        <div className="mt-5">
          {actionHref ? (
            <a
              href={actionHref}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[12px] text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-all duration-200 ease-out shadow-sm"
            >
              {actionLabel}
            </a>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[12px] text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-all duration-200 ease-out shadow-sm"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
