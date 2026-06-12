// Phase 89b — AE forum category metadata (PURE).
export type ForumCategory = 'program' | 'pricing' | 'guideline' | 'special' | 'general';

export const FORUM_CATEGORIES: { key: ForumCategory; label: string; tone: string }[] = [
  { key: 'program', label: 'Program', tone: '#5B8DEF' },
  { key: 'pricing', label: 'Pricing', tone: '#3FB68B' },
  { key: 'guideline', label: 'Guideline', tone: '#E0A93B' },
  { key: 'special', label: 'Rate special', tone: 'var(--c-gold)' },
  { key: 'general', label: 'General', tone: 'var(--c-label3)' },
];

export const CATEGORY_KEYS: ForumCategory[] = FORUM_CATEGORIES.map((c) => c.key);

export function categoryMeta(key: string) {
  return FORUM_CATEGORIES.find((c) => c.key === key) ?? FORUM_CATEGORIES[4];
}
