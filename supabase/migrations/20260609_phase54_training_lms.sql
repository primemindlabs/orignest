-- Phase 54 — Training LMS additions. NOTE: a course LMS already exists as
-- lms_courses + lms_enrollments (live, with embedded lessons/questions/certs).
-- This migration adds (a) the Product Guidelines KB and (b) latent platform-wide
-- course infrastructure (org_id NULL = available to ALL orgs) the org-scoped
-- lms_courses cannot provide. Real schema: tenants->organizations, users->profiles.
CREATE TABLE IF NOT EXISTS training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL, slug text UNIQUE, description text,
  content_type text NOT NULL CHECK (content_type IN ('video','article','quiz','mixed')),
  content_body text, video_url text, duration_minutes integer,
  is_mandatory boolean DEFAULT false, mandatory_for_roles text[] DEFAULT '{}', mandatory_for_channels text[] DEFAULT '{}',
  completion_deadline_days integer, passing_score integer DEFAULT 80, version text DEFAULT '1.0', is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tc_read" ON training_courses;
CREATE POLICY "tc_read" ON training_courses FOR SELECT USING (org_id IS NULL OR org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS training_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  question text NOT NULL, question_type text NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','true_false')),
  options jsonb NOT NULL, correct_option_id text NOT NULL, explanation text, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS enabled, NO select policy → correct answers never readable by clients (API/service-role only).
ALTER TABLE training_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  enrolled_by uuid REFERENCES profiles(id), due_date date, is_mandatory boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, course_id)
);
ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "te_tenant" ON training_enrollments;
CREATE POLICY "te_tenant" ON training_enrollments FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- INSERT-only completion audit (distinct from legacy training_completions/lms_enrollments).
CREATE TABLE IF NOT EXISTS course_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES training_enrollments(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('started','completed','failed','passed')),
  score integer, time_spent_minutes integer, attempt_number integer DEFAULT 1,
  completed_at timestamptz, answers_taken jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_user ON course_completions(user_id, course_id);
ALTER TABLE course_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc_select" ON course_completions;
CREATE POLICY "cc_select" ON course_completions FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cc_insert" ON course_completions;
CREATE POLICY "cc_insert" ON course_completions FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON course_completions FROM PUBLIC, authenticated, service_role, anon;

-- Product Guidelines knowledge base (the genuine new surface this phase ships).
CREATE TABLE IF NOT EXISTS product_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('conventional','fha','va','usda','jumbo','dscr','bank_statement','1099','itin','non_qm','state_compliance','tcpa','respa','trid','cfpb','general')),
  title text NOT NULL, content text NOT NULL, tags text[] DEFAULT '{}', is_active boolean DEFAULT true,
  last_reviewed_date date, next_review_date date, created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_guidelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pg_read" ON product_guidelines;
CREATE POLICY "pg_read" ON product_guidelines FOR SELECT USING (org_id IS NULL OR org_id = public.get_org_id());

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS training_access_gate_enabled boolean DEFAULT false;
-- Seed data (platform courses, quiz questions, guidelines) applied separately.
