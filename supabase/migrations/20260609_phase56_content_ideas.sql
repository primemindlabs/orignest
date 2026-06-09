-- Phase 56.4 — AI content idea library (org_id NULL = platform-wide). Social posting
-- already exists (social_posts/social_dm_accounts); this adds the AI idea engine.
CREATE TABLE IF NOT EXISTS content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  content_type text NOT NULL, title text NOT NULL, caption_template text NOT NULL,
  suggested_hashtags text[] DEFAULT '{}', is_active boolean DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ci_read" ON content_ideas;
CREATE POLICY "ci_read" ON content_ideas FOR SELECT USING (org_id IS NULL OR org_id = public.get_org_id());
-- Platform starter ideas seeded separately.
