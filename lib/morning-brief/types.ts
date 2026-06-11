// Phase 81 — Morning Priority Brief shared types.

export type BriefItemCategory = 'urgent' | 'follow_up' | 'opportunity' | 'info';

// Action types map deterministically to verified routes (see ACTION_ROUTES in generate.ts).
export type BriefItemActionType =
  | 'view_loan'
  | 'view_pipeline'
  | 'view_tasks'
  | 'view_refi'
  | 'view_inbox'
  | 'dismiss';

export type BriefItem = {
  id: string; // stable across same-day regenerations, e.g. "closing:<leadId>"
  category: BriefItemCategory;
  priority: number; // 1 (highest) .. 5
  headline: string; // <= 60 chars, action-oriented
  body: string; // <= 120 chars, supporting context
  action_label: string; // CTA text, <= 20 chars
  action_type: BriefItemActionType;
  action_payload: string | null; // valid Next.js href, or null for 'dismiss'
  lead_id?: string;
  borrower_name?: string;
  loan_amount?: number;
  days_until_deadline?: number;
};

export type MorningBrief = {
  brief_date: string;
  brief_data: BriefItem[];
  dismissed_items: string[];
  generated_at: string | null;
  model_version?: string;
};
