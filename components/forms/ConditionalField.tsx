'use client';

/**
 * Phase 18 — ConditionalField
 *
 * Wraps a 1003 field (or field group). Renders nothing when `visible` is false,
 * so the form stays short and only reveals relevant inputs. Pair with
 * useConditionalForm: <ConditionalField visible={isVisible('va_certificate_type')}>…</ConditionalField>
 */
import type { ReactNode } from 'react';

export function ConditionalField({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  return <div className="animate-fade-in">{children}</div>;
}

/**
 * Inline suggestion list — renders the deterministic Smart-1003 guidance
 * (lib/forms/suggestions.ts) using only design-system tokens.
 */
export function FormSuggestions({
  suggestions,
}: {
  suggestions: { id: string; severity: 'info' | 'warning'; message: string }[];
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <div
          key={s.id}
          className={`rounded-card border px-3.5 py-2.5 text-sm leading-snug ${
            s.severity === 'warning'
              ? 'bg-orange/5 border-orange/20 text-black'
              : 'bg-gold/10 border-gold/30 text-black'
          }`}
        >
          {s.message}
        </div>
      ))}
    </div>
  );
}
