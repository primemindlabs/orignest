/**
 * Phase 99 — funnel stages = the REAL leads.stage values (the spec's 'inquiry' is
 * 'new_inquiry' here, and 'funded' is 'closed'). declined/withdrawn are terminal
 * exits, not funnel steps, so they're excluded.
 */
export const FUNNEL_STAGES = [
  'new_inquiry',
  'pre_qual',
  'application',
  'processing',
  'underwriting',
  'conditional_approval',
  'clear_to_close',
  'closed',
] as const;

export type FunnelStageName = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageName, string> = {
  new_inquiry: 'Inquiry',
  pre_qual: 'Pre-Qualification',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditional Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Funded',
};

export function isFunnelStage(s: string): s is FunnelStageName {
  return (FUNNEL_STAGES as readonly string[]).includes(s);
}

export function stageIndex(stage: string): number {
  return (FUNNEL_STAGES as readonly string[]).indexOf(stage);
}

export function nextStage(stage: FunnelStageName): FunnelStageName | null {
  const idx = FUNNEL_STAGES.indexOf(stage);
  return idx >= 0 && idx < FUNNEL_STAGES.length - 1 ? FUNNEL_STAGES[idx + 1] : null;
}
