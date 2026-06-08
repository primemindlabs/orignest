'use client';

/**
 * Phase 18 — useConditionalForm
 *
 * Given the current form values and a set of conditional rules, returns which
 * fields should be visible. A field that never appears in any rule's `show`
 * list is "always visible"; a field that does appear is hidden until one of its
 * rules is satisfied. Hidden field VALUES are intentionally preserved in the
 * caller's state so toggling a trigger back restores prior input.
 */
import { useMemo } from 'react';
import { conditionalRules as defaultRules, type ConditionalRule } from '@/lib/forms/conditionalRules';

export interface UseConditionalForm {
  /** field keys currently revealed by an active rule */
  visibleFields: Set<string>;
  /** every field key that is governed by a rule (i.e. conditional) */
  conditionalFields: Set<string>;
  /** true if the field should render now */
  isVisible: (fieldKey: string) => boolean;
  /** count of conditional fields not yet shown — for a "+N more fields" hint */
  hiddenCount: number;
}

export function useConditionalForm(
  formValues: Record<string, unknown>,
  rules: ConditionalRule[] = defaultRules,
): UseConditionalForm {
  const conditionalFields = useMemo(() => {
    const set = new Set<string>();
    for (const rule of rules) for (const f of rule.show) set.add(f);
    return set;
  }, [rules]);

  const visibleFields = useMemo(() => {
    const set = new Set<string>();
    for (const rule of rules) {
      if (formValues[rule.trigger] === rule.value) {
        for (const f of rule.show) set.add(f);
      }
    }
    return set;
  }, [formValues, rules]);

  const isVisible = (fieldKey: string) =>
    !conditionalFields.has(fieldKey) || visibleFields.has(fieldKey);

  return {
    visibleFields,
    conditionalFields,
    isVisible,
    hiddenCount: conditionalFields.size - visibleFields.size,
  };
}
