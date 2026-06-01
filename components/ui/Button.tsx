'use client';

import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue text-white hover:bg-blue/90 active:bg-blue/80 shadow-sm',
  secondary:
    'bg-[rgba(60,60,67,0.08)] text-black hover:bg-[rgba(60,60,67,0.12)] active:bg-[rgba(60,60,67,0.16)]',
  ghost:
    'bg-transparent text-blue hover:bg-blue/8 active:bg-blue/12',
  danger:
    'bg-red text-white hover:bg-red/90 active:bg-red/80 shadow-sm',
  outline:
    'bg-surface border border-[rgba(60,60,67,0.2)] text-black hover:bg-[rgba(60,60,67,0.04)] active:bg-[rgba(60,60,67,0.08)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-[14px] gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center rounded-btn font-medium',
          'transition-all duration-100 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-1',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'select-none',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {!loading && rightIcon ? rightIcon : null}
      </button>
    );
  }
);

Button.displayName = 'Button';
