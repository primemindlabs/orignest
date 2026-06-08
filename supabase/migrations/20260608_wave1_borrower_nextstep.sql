-- Phase 4.5 — cache for the AI "what happens next" borrower card
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step_ai text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step_ai_stage text;
