'use client';

import { clsx } from 'clsx';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, rightAddon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-black"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 flex items-center text-label-2 pointer-events-none">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full h-9 rounded-[10px] border bg-surface px-3 text-[14px] text-black',
              'placeholder:text-label-3',
              'transition-colors duration-100',
              'focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error
                ? 'border-red focus:border-red focus:ring-red/20'
                : 'border-[rgba(60,60,67,0.2)] hover:border-[rgba(60,60,67,0.35)]',
              leftAddon && 'pl-9',
              rightAddon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 flex items-center text-label-2">
              {rightAddon}
            </div>
          )}
        </div>
        {error && <p className="text-[12px] text-red">{error}</p>}
        {!error && hint && <p className="text-[12px] text-label-2">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
