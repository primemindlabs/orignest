-- ============================================================
-- AshleyIQ v2 — Wave 1 pipeline batch
-- 1.1 stage automation · 1.3 dup/merge · 1.4 velocity · 5.2 condition templates
-- 2026-06-08 · idempotent
-- ============================================================
BEGIN;

-- ── leads: stage timing + merge bookkeeping ──────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE leads SET stage_changed_at = COALESCE(stage_changed_at, updated_at, created_at)
WHERE stage_changed_at IS NULL;

-- Auto-maintain stage_changed_at on ANY update path (no app code needed everywhere).
CREATE OR REPLACE FUNCTION public.set_stage_changed_at() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS leads_set_stage_changed_at ON leads;
CREATE TRIGGER leads_set_stage_changed_at
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION public.set_stage_changed_at();

-- ── 1.1 — stage_transition_rules (org_id NULL = platform default) ─────────────
CREATE TABLE IF NOT EXISTS stage_transition_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,
  from_stage    text NOT NULL,
  to_stage      text NOT NULL,
  trigger_event text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stage_transition_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "str_select" ON stage_transition_rules;
CREATE POLICY "str_select" ON stage_transition_rules
  FOR SELECT USING (org_id IS NULL OR org_id = public.get_org_id());
DROP POLICY IF EXISTS "str_write" ON stage_transition_rules;
CREATE POLICY "str_write" ON stage_transition_rules
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE INDEX IF NOT EXISTS idx_str_trigger ON stage_transition_rules(trigger_event, is_active);

-- Platform-default transition rules (real lead stages).
INSERT INTO stage_transition_rules (org_id, from_stage, to_stage, trigger_event)
SELECT * FROM (VALUES
  (NULL::uuid, 'new_inquiry',          'pre_qual',            'soft_pull_completed'),
  (NULL::uuid, 'pre_qual',             'application',         'application_submitted'),
  (NULL::uuid, 'new_inquiry',          'application',         'application_submitted'),
  (NULL::uuid, 'application',          'processing',          'application_submitted'),
  (NULL::uuid, 'processing',           'underwriting',        'loan_submitted_to_uw'),
  (NULL::uuid, 'underwriting',         'conditional_approval','loan_approved'),
  (NULL::uuid, 'conditional_approval', 'clear_to_close',      'conditions_cleared'),
  (NULL::uuid, 'clear_to_close',       'closed',              'closed')
) v(org_id, from_stage, to_stage, trigger_event)
WHERE NOT EXISTS (
  SELECT 1 FROM stage_transition_rules s
  WHERE s.org_id IS NULL AND s.from_stage = v.from_stage
    AND s.to_stage = v.to_stage AND s.trigger_event = v.trigger_event
);

-- ── 1.4 — stage SLA config ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_sla_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,
  stage         text NOT NULL,
  warning_days  integer NOT NULL DEFAULT 3,
  critical_days integer NOT NULL DEFAULT 7,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stage_sla_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sla_select" ON stage_sla_config;
CREATE POLICY "sla_select" ON stage_sla_config
  FOR SELECT USING (org_id IS NULL OR org_id = public.get_org_id());
DROP POLICY IF EXISTS "sla_write" ON stage_sla_config;
CREATE POLICY "sla_write" ON stage_sla_config
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

INSERT INTO stage_sla_config (org_id, stage, warning_days, critical_days)
SELECT * FROM (VALUES
  (NULL::uuid, 'new_inquiry',          1, 3),
  (NULL::uuid, 'pre_qual',             2, 5),
  (NULL::uuid, 'application',          3, 7),
  (NULL::uuid, 'processing',           5, 10),
  (NULL::uuid, 'underwriting',         4, 8),
  (NULL::uuid, 'conditional_approval', 3, 7),
  (NULL::uuid, 'clear_to_close',       2, 5)
) v(org_id, stage, warning_days, critical_days)
WHERE NOT EXISTS (SELECT 1 FROM stage_sla_config s WHERE s.org_id IS NULL AND s.stage = v.stage);

-- ── 5.2 — condition_templates (org_id NULL = platform default) ────────────────
CREATE TABLE IF NOT EXISTS condition_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,
  loan_program  text NOT NULL,
  condition_text text NOT NULL,
  category      text NOT NULL DEFAULT 'other'
                CHECK (category IN ('income','credit','assets','property','title','insurance','other')),
  priority      text NOT NULL DEFAULT 'standard'
                CHECK (priority IN ('standard','prior_to_docs','prior_to_funding','prior_to_closing')),
  phase         text NOT NULL DEFAULT 'processing'
                CHECK (phase IN ('processing','underwriting','closing','post_closing')),
  is_default    boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE condition_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ct_select" ON condition_templates;
CREATE POLICY "ct_select" ON condition_templates
  FOR SELECT USING (org_id IS NULL OR org_id = public.get_org_id());
DROP POLICY IF EXISTS "ct_write" ON condition_templates;
CREATE POLICY "ct_write" ON condition_templates
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE INDEX IF NOT EXISTS idx_ct_program ON condition_templates(loan_program) WHERE org_id IS NULL;

-- Seed platform-default condition checklists (only if none seeded yet).
INSERT INTO condition_templates (org_id, loan_program, condition_text, category, priority, phase, display_order)
SELECT * FROM (VALUES
  -- FHA
  (NULL::uuid,'FHA','Most recent 30 days of pay stubs','income','prior_to_docs','processing',1),
  (NULL::uuid,'FHA','W-2s for the most recent two years','income','prior_to_docs','processing',2),
  (NULL::uuid,'FHA','Two months of bank statements (all pages)','assets','prior_to_docs','processing',3),
  (NULL::uuid,'FHA','FHA case number assigned','property','prior_to_docs','underwriting',4),
  (NULL::uuid,'FHA','FHA appraisal with HUD addendum','property','prior_to_docs','underwriting',5),
  (NULL::uuid,'FHA','Upfront MIP and annual MIP disclosed and acknowledged','insurance','prior_to_closing','underwriting',6),
  (NULL::uuid,'FHA','CAIVRS cleared (no federal delinquencies)','credit','prior_to_docs','underwriting',7),
  (NULL::uuid,'FHA','Photo ID and Social Security verification','credit','prior_to_docs','processing',8),
  (NULL::uuid,'FHA','Homeowners insurance binder with mortgagee clause','insurance','prior_to_closing','closing',9),
  (NULL::uuid,'FHA','Clear title commitment','title','prior_to_closing','closing',10),
  -- Conventional
  (NULL::uuid,'Conventional','Most recent 30 days of pay stubs','income','prior_to_docs','processing',1),
  (NULL::uuid,'Conventional','W-2s for the most recent two years','income','prior_to_docs','processing',2),
  (NULL::uuid,'Conventional','Two months of bank statements (all pages)','assets','prior_to_docs','processing',3),
  (NULL::uuid,'Conventional','Appraisal supporting value','property','prior_to_docs','underwriting',4),
  (NULL::uuid,'Conventional','PMI disclosure if LTV > 80%','insurance','prior_to_closing','underwriting',5),
  (NULL::uuid,'Conventional','Verification of employment (VOE)','income','prior_to_funding','underwriting',6),
  (NULL::uuid,'Conventional','Source/seasoning of large deposits','assets','prior_to_docs','underwriting',7),
  (NULL::uuid,'Conventional','Homeowners insurance binder with mortgagee clause','insurance','prior_to_closing','closing',8),
  (NULL::uuid,'Conventional','Clear title commitment','title','prior_to_closing','closing',9),
  -- VA
  (NULL::uuid,'VA','Certificate of Eligibility (COE)','credit','prior_to_docs','processing',1),
  (NULL::uuid,'VA','DD-214 / statement of service','income','prior_to_docs','processing',2),
  (NULL::uuid,'VA','VA appraisal (Notice of Value)','property','prior_to_docs','underwriting',3),
  (NULL::uuid,'VA','Funding fee determination (or exemption evidence)','assets','prior_to_funding','underwriting',4),
  (NULL::uuid,'VA','Most recent 30 days of pay stubs','income','prior_to_docs','processing',5),
  (NULL::uuid,'VA','Residual income worksheet meets VA minimum','income','prior_to_docs','underwriting',6),
  (NULL::uuid,'VA','Termite / pest inspection where required','property','prior_to_closing','closing',7),
  (NULL::uuid,'VA','Homeowners insurance binder with mortgagee clause','insurance','prior_to_closing','closing',8),
  (NULL::uuid,'VA','Clear title commitment','title','prior_to_closing','closing',9),
  -- DSCR
  (NULL::uuid,'DSCR','Signed lease agreement(s) or market rent schedule (1007)','income','prior_to_docs','processing',1),
  (NULL::uuid,'DSCR','Rent roll for the subject property','income','prior_to_docs','processing',2),
  (NULL::uuid,'DSCR','DSCR calculation worksheet (>= program minimum)','income','prior_to_docs','underwriting',3),
  (NULL::uuid,'DSCR','Entity formation docs (LLC / corp) + operating agreement','title','prior_to_docs','underwriting',4),
  (NULL::uuid,'DSCR','EIN letter for the borrowing entity','title','prior_to_docs','underwriting',5),
  (NULL::uuid,'DSCR','Appraisal with comparable rent analysis','property','prior_to_docs','underwriting',6),
  (NULL::uuid,'DSCR','Two months reserves for PITIA','assets','prior_to_funding','underwriting',7),
  (NULL::uuid,'DSCR','Landlord / property insurance binder','insurance','prior_to_closing','closing',8),
  (NULL::uuid,'DSCR','Clear title commitment','title','prior_to_closing','closing',9)
) v(org_id, loan_program, condition_text, category, priority, phase, display_order)
WHERE NOT EXISTS (SELECT 1 FROM condition_templates t WHERE t.org_id IS NULL);

COMMIT;
