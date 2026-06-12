-- Phase 82 — Loan File AI (Contextual Q&A) audit log.
-- INSERT-only audit record of every AI question/answer about a specific loan file.
-- Adapted to real conventions: org_id uuid + user_id -> profiles(id) (Clerk auth, not
-- auth.users), service-role writes via admin client, get_org_id() RLS for reads.

CREATE TABLE IF NOT EXISTS loan_ai_queries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  question            TEXT NOT NULL,
  answer              TEXT NOT NULL,
  sources             TEXT[] NOT NULL DEFAULT '{}',
  context_fields_used TEXT[] NOT NULL DEFAULT '{}',
  model_version       TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  tokens_used         INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_ai_queries_lead
  ON loan_ai_queries (lead_id, created_at DESC);

ALTER TABLE loan_ai_queries ENABLE ROW LEVEL SECURITY;

-- Members read their org's query log (history endpoint additionally narrows to the lead).
CREATE POLICY "loan_ai_queries_org_select"
  ON loan_ai_queries FOR SELECT
  USING (org_id = public.get_org_id());

-- Writes go through the service-role admin client (org/user scoping enforced in the route).
CREATE POLICY "loan_ai_queries_service_insert"
  ON loan_ai_queries FOR INSERT
  WITH CHECK (TRUE);

-- INSERT-only audit: no UPDATE / DELETE for anyone, including service_role.
REVOKE UPDATE, DELETE, TRUNCATE ON loan_ai_queries FROM PUBLIC, anon, authenticated, service_role;
