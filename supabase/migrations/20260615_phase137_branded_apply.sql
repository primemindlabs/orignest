-- Phase 137 — Branded application links: {brokerage-slug}.ashleyiq.com/{mlo-slug}
-- Adds a per-organization URL slug (the {brokerage} segment). The {mlo} segment
-- reuses the existing profiles.application_slug (Phase 90). The public full Smart-1003
-- form is driven token-gated off loan_applications.application_token (already exists).
-- Applied to Originest (dhnxiijduycmzfjmohyp) 2026-06-15.

alter table organizations add column if not exists slug text;

-- Backfill a slug from the org name for every existing org that lacks one.
update organizations o
set slug = regexp_replace(
             regexp_replace(lower(coalesce(nullif(trim(o.name), ''), 'org')), '[^a-z0-9]+', '-', 'g'),
             '(^-+|-+$)', '', 'g'
           )
where o.slug is null or o.slug = '';

-- Empty result (name was all punctuation) → fall back to a stable id fragment.
update organizations o
set slug = 'org-' || substr(o.id::text, 1, 8)
where o.slug is null or o.slug = '';

-- De-duplicate collisions: keep the oldest org's slug, suffix the rest with an id fragment.
with ranked as (
  select id, slug, row_number() over (partition by slug order by created_at, id) as rn
  from organizations
  where slug is not null
)
update organizations o
set slug = o.slug || '-' || substr(o.id::text, 1, 6)
from ranked r
where o.id = r.id and r.rn > 1;

create unique index if not exists uq_organizations_slug on organizations(slug);

-- Provenance: how a loan_application was started (public branded link vs in-app).
alter table loan_applications add column if not exists submitted_via text;

-- Latent bug: application_token defaulted to encode(...,'base64url'), an encoding
-- this Postgres rejects — so every insert relying on the default threw and the table
-- stayed empty (in-app 1003 drafts never persisted either). hex is URL-safe + supported.
alter table loan_applications
  alter column application_token set default encode(gen_random_bytes(24), 'hex');
