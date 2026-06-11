'use client';

import type { ReactNode } from 'react';

/** Label + optional hint + inline error wrapper used across the settings forms. */
export function SettingsField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-red">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-label-3">{hint}</p>
      ) : null}
    </div>
  );
}
