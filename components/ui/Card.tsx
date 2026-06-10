import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  /** Phase 65: visual variant. 'default' is unchanged for backward compatibility. */
  variant?: 'default' | 'elevated' | 'gold' | 'inset' | 'ghost';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

// 'default' = the original look (no caller is affected unless they opt into a variant).
const variantClasses = {
  default: 'bg-surface rounded-card border border-[rgba(60,60,67,0.12)] shadow-card',
  elevated: 'bg-white rounded-card border border-[rgba(15,29,46,0.06)] shadow-[var(--shadow-md)]',
  gold: 'bg-white rounded-card border border-[var(--gold-300)] shadow-[var(--shadow-gold)]',
  inset: 'bg-[var(--surface-2)] rounded-card border border-[rgba(15,29,46,0.06)]',
  ghost: 'bg-transparent rounded-card border border-[rgba(15,29,46,0.08)]',
};

export function Card({
  padding = 'md',
  hoverable = false,
  variant = 'default',
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        variantClasses[variant],
        paddingClasses[padding],
        hoverable &&
          'cursor-pointer transition-shadow duration-150 hover:shadow-[0_2px_12px_rgba(0,0,0,0.10)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  children,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-start justify-between gap-3 pb-3 mb-3',
        'border-b border-[rgba(60,60,67,0.08)]',
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="text-[15px] font-semibold text-black leading-tight">{title}</h3>
        )}
        {subtitle && (
          <p className="text-[13px] text-label-2 mt-0.5">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardSection({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('py-3 border-b border-[rgba(60,60,67,0.06)] last:border-0', className)} {...props}>
      {children}
    </div>
  );
}
