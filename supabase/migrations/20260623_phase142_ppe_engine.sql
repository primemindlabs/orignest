-- =============================================================================
-- Phase 142 — Product & Pricing Engine (best-execution + anti-steering)
-- =============================================================================
-- Upgrades the P114 rate-sheet schema into a real adjustment stack:
--   * rate_sheet_products gains risky-feature flags (for the §1026.36(e)(3)
--     anti-steering "lowest rate without risky features" option).
--   * rate_sheet_llpas gains the extra dimensions a real LLPA grid needs
--     (occupancy, property type, loan type, amortization, loan-amount band,
--     lock period). All nullable: a null bound = unconstrained on that axis,
--     so existing rows keep matching exactly as before (backward compatible).

alter table public.rate_sheet_products
  add column if not exists interest_only   boolean not null default false,
  add column if not exists prepay_penalty  boolean not null default false,
  add column if not exists balloon         boolean not null default false,
  add column if not exists neg_am          boolean not null default false;

alter table public.rate_sheet_llpas
  add column if not exists loan_type        text,
  add column if not exists occupancy        text,
  add column if not exists property_type    text,
  add column if not exists amort_type       text,
  add column if not exists min_loan_amount  numeric(12,2),
  add column if not exists max_loan_amount  numeric(12,2),
  add column if not exists lock_days        integer;
