-- Phase 134 — NMLS soft-lock on outbound borrower communication.
--
-- Some loan officers on the platform legitimately do not carry an individual NMLS
-- number: registered MLOs employed by a federally-insured depository (bank/credit
-- union) are covered by the institution's registration, and commercial-only
-- originators are outside SAFE-Act licensing entirely. So the gate is SOFT: an LO
-- without an nmls_id can self-attest an exemption and unlock communications.
--
-- Additive only — three nullable columns on profiles. No data backfill needed
-- (default false = "must provide NMLS or attest exemption before sending").

alter table public.profiles
  add column if not exists comms_exempt boolean not null default false;

alter table public.profiles
  add column if not exists comms_exempt_reason text
    check (comms_exempt_reason is null or comms_exempt_reason in (
      'depository_registered',  -- registered MLO under a bank/credit union's NMLS
      'commercial_only',        -- commercial/business-purpose lending only (no SAFE licensing)
      'other'
    ));

alter table public.profiles
  add column if not exists comms_exempt_at timestamptz;
