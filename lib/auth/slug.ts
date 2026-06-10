/**
 * Phase 90 — LO application-link slugs.
 *
 * `generateSlug` is a pure helper. `ensureApplicationSlug` persists a unique slug
 * on a profile on-demand (no insert trigger; called when the LO first needs their
 * link). It takes the Supabase client as a param so it stays environment-agnostic.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** "Jordan", "McIntyre", "1037654" -> "jordan-mcintyre-7654" */
export function generateSlug(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  nmls: string | null | undefined
): string {
  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'lo';
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = (nmls ?? '').replace(/\D/g, '').slice(-4);
  return suffix ? `${base}-${suffix}` : base;
}

interface SlugProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nmls_id: string | null;
  application_slug: string | null;
}

/**
 * Returns the profile's application slug, generating + persisting a unique one if
 * absent. Disambiguates collisions with a numeric suffix. Returns null only if the
 * update fails.
 */
export async function ensureApplicationSlug(
  sb: SupabaseClient,
  profile: SlugProfile
): Promise<string | null> {
  if (profile.application_slug) return profile.application_slug;

  const base = generateSlug(profile.first_name, profile.last_name, profile.nmls_id);
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { data: clash } = await sb
      .from('profiles')
      .select('id')
      .eq('application_slug', slug)
      .maybeSingle();
    if (!clash || clash.id === profile.id) break;
    slug = `${base}-${n}`;
  }

  const { error } = await sb.from('profiles').update({ application_slug: slug }).eq('id', profile.id);
  if (error) return null;
  return slug;
}
