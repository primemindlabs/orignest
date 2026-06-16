-- Phase 139 — Real AI images for Content Studio posts.
-- Each generated post can carry a generated graphic stored in the public
-- `content-images` bucket; image_url holds its public URL.

alter table content_posts add column if not exists image_url text;

-- Public bucket for shareable social graphics.
insert into storage.buckets (id, name, public)
values ('content-images', 'content-images', true)
on conflict (id) do nothing;
