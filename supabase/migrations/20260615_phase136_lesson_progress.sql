-- Phase 136 — per-lesson progress for the LMS (Udemy/Thinkific-style course player).
-- lms_courses.lessons is a JSONB array; a lesson is identified by its array index.
-- Applied to Originest (dhnxiijduycmzfjmohyp) 2026-06-15.
create table if not exists lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  course_id     uuid not null references lms_courses(id) on delete cascade,
  lesson_index  integer not null,
  completed     boolean not null default true,
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint uq_lesson_progress unique (org_id, profile_id, course_id, lesson_index)
);
create index if not exists idx_lesson_progress_lookup on lesson_progress(org_id, profile_id, course_id);
alter table lesson_progress enable row level security;
drop policy if exists "lesson_progress_select" on lesson_progress;
create policy "lesson_progress_select" on lesson_progress for select using (org_id = public.get_org_id());
drop policy if exists "lesson_progress_write" on lesson_progress;
create policy "lesson_progress_write" on lesson_progress for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());
