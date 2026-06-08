import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green/12 text-[#1a7a34]',
  warning: 'bg-orange/12 text-[#8f5500]',
  danger: 'bg-red/12 text-[#c0000a]',
  info: 'bg-blue/12 text-[#0050aa]',
  neutral: 'bg-[rgba(60,60,67,0.08)] text-label-2',
  gold: 'bg-gold/12 text-[#7a5f20]',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-green',
  warning: 'bg-orange',
  danger: 'bg-red',
  info: 'bg-blue',
  neutral: 'bg-label-3',
  gold: 'bg-gold',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-1.5 py-0.5 gap-1',
  md: 'text-[12px] px-2 py-1 gap-1.5',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium leading-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx('rounded-full flex-shrink-0', dotColors[variant], {
            'w-1.5 h-1.5': size === 'md',
            'w-1 h-1': size === 'sm',
          })}
        />
      )}
      {children}
    </span>
  );
}
