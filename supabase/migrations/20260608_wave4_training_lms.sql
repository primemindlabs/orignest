-- ============================================================
-- AshleyIQ v2 — Wave 4 · Phase 15: Training LMS
-- 2026-06-08
-- Courses (lessons + quiz as JSONB), enrollments with scoring & certs.
-- ============================================================
CREATE TABLE IF NOT EXISTS lms_courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  category        text NOT NULL DEFAULT 'general',
  is_compliance   boolean NOT NULL DEFAULT false,
  pass_threshold  integer NOT NULL DEFAULT 80 CHECK (pass_threshold BETWEEN 0 AND 100),
  lessons         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{title, content}]
  questions       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{q, options:[], correct:int}]
  is_published    boolean NOT NULL DEFAULT true,
  is_onboarding   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lms_courses_org_id ON lms_courses(org_id);
ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lms_courses_select" ON lms_courses;
CREATE POLICY "lms_courses_select" ON lms_courses FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lms_courses_write" ON lms_courses;
CREATE POLICY "lms_courses_write" ON lms_courses FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS lms_enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  profile_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed','failed')),
  score             integer,
  certificate_code  text,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lms_enrollment UNIQUE (org_id, course_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_org ON lms_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_profile ON lms_enrollments(org_id, profile_id);
ALTER TABLE lms_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lms_enrollments_select" ON lms_enrollments;
CREATE POLICY "lms_enrollments_select" ON lms_enrollments FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lms_enrollments_write" ON lms_enrollments;
CREATE POLICY "lms_enrollments_write" ON lms_enrollments FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
