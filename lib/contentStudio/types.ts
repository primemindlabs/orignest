/** Phase 132 — Ashley Content Studio™ shared types. lo_id→profiles(id). */

export type Platform = 'linkedin' | 'instagram' | 'facebook';

export type PostStatus = 'draft' | 'edited' | 'approved' | 'scheduled' | 'published' | 'skipped';

export interface LOProfile {
  id: string;
  first_name: string;
  last_name: string;
  nmls_id: string | null;
  licensed_states: string[];
  company_name: string;
  company_nmls: string | null;
}

/** A generated post before persistence. */
export interface GeneratedPost {
  platform: Platform;
  content_type: string;
  post_day: string;
  post_text: string;
  hashtags: string | null;
  image_prompt: string | null;
  nmls_footer: string;
  status: 'draft';
}

/** A persisted content_posts row (subset used by the UI). */
export interface ContentPostRow extends Omit<GeneratedPost, 'status'> {
  id: string;
  package_id: string;
  edited_text: string | null;
  image_url: string | null;
  lo_approved: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  status: PostStatus;
}

export interface ContentPackageRow {
  id: string;
  lo_id: string;
  week_of: string;
  generation_topic: string | null;
  market_area: string | null;
  status: string;
  posts_generated: number;
  created_at: string;
}

export const WEEKLY_TOPICS: { day: string; platform: Platform; type: string; label: string }[] = [
  { day: 'monday', platform: 'linkedin', type: 'market_insight', label: 'Market insight' },
  { day: 'tuesday', platform: 'instagram', type: 'quick_tip', label: 'Quick tip' },
  { day: 'wednesday', platform: 'facebook', type: 'community_education', label: 'Community education' },
  { day: 'thursday', platform: 'linkedin', type: 'anonymized_win', label: 'Anonymized win' },
  { day: 'friday', platform: 'instagram', type: 'behind_the_scenes', label: 'Behind the scenes' },
  { day: 'saturday', platform: 'facebook', type: 'rate_environment', label: 'Rate environment' },
  { day: 'sunday', platform: 'instagram', type: 'aspirational', label: 'Aspirational' },
];
