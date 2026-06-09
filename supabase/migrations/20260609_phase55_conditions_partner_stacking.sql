-- Phase 55.3/55.1/55.4 — agent-safe conditions + CLOSA partner bridge (gated) +
-- doc stacking. Real schema: users->profiles, loans=leads. (Full DDL applied via MCP
-- migration phase55_conditions_partner_stacking; Fannie template seeded separately.)
ALTER TABLE loan_conditions ADD COLUMN IF NOT EXISTS is_agent_visible boolean DEFAULT false;
ALTER TABLE loan_conditions ADD COLUMN IF NOT EXISTS agent_visible_description text;
-- partner_platform_connections (api_key_encrypted AES + api_key_hash SHA-256) +
-- outbound_partner_referrals + inbound_partner_referrals (UNIQUE platform_referral_id).
-- doc_stacking_templates (org NULL = platform) + doc_stacks (merged_pdf_url). All org_id RLS.
