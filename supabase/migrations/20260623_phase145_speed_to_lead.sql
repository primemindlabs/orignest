-- =============================================================================
-- Phase 145 — Speed-to-Lead (auto first-touch via Ashley Concierge)
-- =============================================================================
-- loanofficer.ai's headline "respond in <60 seconds" claim: when a brand-new lead
-- comes in with SMS consent, Ashley Concierge (Phase 144) sends the FIRST text
-- automatically and opens the conversation in the LO's configured mode.
--
-- One opt-in flag on the per-LO concierge settings. The first-touch path reuses the
-- same persona, compliance guard, and TCPA gate as the inbound engine — and the
-- conversation table's unique(org_id, lead_id) prevents a double opener. Driven by a
-- minutely cron that picks up newly-created, consented, not-yet-contacted leads.
-- Apply AFTER 20260623_phase144_concierge.sql.
-- =============================================================================

alter table public.ai_concierge_settings
  add column if not exists speed_to_lead boolean not null default false;
