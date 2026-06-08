'use client';

import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-[13px] font-medium text-black">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full h-9 rounded-[10px] border bg-surface pl-3 pr-8 text-[14px] text-black appearance-none',
              'transition-colors duration-100',
              'focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error
                ? 'border-red focus:border-red focus:ring-red/20'
                : 'border-[rgba(60,60,67,0.2)] hover:border-[rgba(60,60,67,0.35)]',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-label-2 pointer-events-none"
          />
        </div>
        {error && <p className="text-[12px] text-red">{error}</p>}
        {!error && hint && <p className="text-[12px] text-label-2">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
