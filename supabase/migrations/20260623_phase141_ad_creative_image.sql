-- Phase 141 — Real AI images for ad creatives. Reuses the public content-images
-- bucket (created in phase139); ad images live under {orgId}/ad-*.
alter table ad_creatives add column if not exists image_url text;
