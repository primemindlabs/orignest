// Phase 98 — referral source label + badge-color maps (shared across components).

/** Short labels for the badge chip. */
export const SOURCE_BADGE_LABELS: Record<string, string> = {
  realtor: 'Realtor', zillow: 'Zillow', meta_ads: 'Meta Ads', google_ads: 'Google',
  referral: 'Referral', organic: 'Organic', other: 'Other', untagged: 'Untagged',
};

/** Longer labels for selects / table rows. */
export const SOURCE_SELECT_LABELS: Record<string, string> = {
  realtor: 'Realtor', zillow: 'Zillow Premier Agent', meta_ads: 'Meta Ads', google_ads: 'Google Ads',
  referral: 'Referral Partner', organic: 'Organic / Free', other: 'Other', untagged: 'Untagged',
};

export const SOURCE_BADGE_CLASSES: Record<string, string> = {
  realtor: 'bg-purple-50 text-purple-700',
  zillow: 'bg-blue-50 text-blue-700',
  meta_ads: 'bg-indigo-50 text-indigo-700',
  google_ads: 'bg-yellow-50 text-yellow-700',
  referral: 'bg-teal-50 text-teal-700',
  organic: 'bg-gray-100 text-gray-600',
  other: 'bg-gray-100 text-gray-500',
  untagged: 'bg-gray-100 text-gray-400',
};

export const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'realtor', label: 'Realtor' },
  { value: 'zillow', label: 'Zillow Premier Agent' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'referral', label: 'Referral Partner' },
  { value: 'organic', label: 'Organic / Free' },
  { value: 'other', label: 'Other' },
];

export const DETAIL_PLACEHOLDERS: Record<string, string> = {
  realtor: 'Realtor name (e.g. Jane Smith)',
  zillow: 'Campaign or package name',
  meta_ads: 'Campaign name or ad set',
  google_ads: 'Campaign name or keyword group',
  referral: 'Partner name or company',
  organic: 'Additional detail (optional)',
  other: 'Additional detail (optional)',
};
