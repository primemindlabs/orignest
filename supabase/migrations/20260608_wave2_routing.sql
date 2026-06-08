-- ============================================================
-- AshleyIQ v2 — Wave 2 · Speed-to-Lead routing (2.1–2.5)
-- 2026-06-08 · idempotent
-- ============================================================
BEGIN;

-- ── 2.1/2.2 — per-LO routing config (capacity, pause, weight, response rate) ──
CREATE TABLE IF NOT EXISTS lo_routing_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  max_active_leads integer NOT NULL DEFAULT 50,
  routing_paused  boolean NOT NULL DEFAULT false,
  pause_reason    text,
  response_rate   numeric(5,2) NOT NULL DEFAULT 100.00,
  routing_weight  integer NOT NULL DEFAULT 10,   -- higher = more leads
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lo_id)
);
ALTER TABLE lo_routing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lrc_all" ON lo_routing_config;
CREATE POLICY "lrc_all" ON lo_routing_config
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── 2.3 — time-of-day / day-of-week routing rules ────────────────────────────
CREATE TABLE IF NOT EXISTS routing_time_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id        uuid REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = all LOs
  day_of_week  integer[] NOT NULL,                              -- 0=Sun .. 6=Sat
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  action       text NOT NULL CHECK (action IN
                 ('route_normally','route_to_backup','hold_for_business_hours','send_to_ai_prequalifier')),
  backup_lo_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  timezone     text NOT NULL DEFAULT 'America/New_York',
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE routing_time_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rtr_all" ON routing_time_rules;
CREATE POLICY "rtr_all" ON routing_time_rules
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── 2.4 — AI pre-qualification sessions (Twilio SMS + Claude) ─────────────────
CREATE TABLE IF NOT EXISTS ai_prequalifier_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  status         text NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress','completed','escalated','abandoned')),
  transcript     jsonb NOT NULL DEFAULT '[]',     -- [{role:'ai'|'borrower', message, timestamp}]
  extracted_data jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_prequalifier_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aps_all" ON ai_prequalifier_sessions;
CREATE POLICY "aps_all" ON ai_prequalifier_sessions
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE INDEX IF NOT EXISTS idx_aps_lead ON ai_prequalifier_sessions(lead_id);

-- ── 2.5 — lead accept/reject tracking ────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS routed_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE TABLE IF NOT EXISTS lead_routing_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lo_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event      text NOT NULL CHECK (event IN ('routed','accepted','rejected','reassigned','overflow','no_response')),
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lead_routing_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lrl_select" ON lead_routing_log;
CREATE POLICY "lrl_select" ON lead_routing_log
  FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lrl_insert" ON lead_routing_log;
CREATE POLICY "lrl_insert" ON lead_routing_log
  FOR INSERT WITH CHECK (org_id = public.get_org_id());
CREATE INDEX IF NOT EXISTS idx_lrl_lead ON lead_routing_log(lead_id, created_at DESC);

COMMIT;
