/**
 * Phase 137 — organization URL slugs (the {brokerage} segment of a branded
 * application link, e.g. `equitynest-capital.ashleyiq.com`).
 *
 * `generateOrgSlug` is pure. `ensureOrgSlug` persists a unique slug on-demand
 * (the Clerk org webhook sets one on create; this backstops any org that
 * predates that path or lost its slug). Mirrors lib/auth/slug.ts for profiles.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** "EquityNest Capital" -> "equitynest-capital" */
export function generateOrgSlug(name: string | null | undefined): string {
  const base = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'org';
}

interface SlugOrg {
  id: string;
  name: string | null;
  slug: string | null;
}

/**
 * Returns the org's slug, generating + persisting a unique one if absent.
 * Disambiguates collisions with an id fragment. Returns null only on write failure.
 */
export async function ensureOrgSlug(sb: SupabaseClient, org: SlugOrg): Promise<string | null> {
  if (org.slug) return org.slug;

  const base = generateOrgSlug(org.name);
  let slug = base;
  for (let n = 0; n < 50; n++) {
    const { data: clash } = await sb.from('organizations').select('id').eq('slug', slug).maybeSingle();
    if (!clash || clash.id === org.id) break;
    slug = `${base}-${org.id.slice(0, 6)}`; // deterministic, collision-proof second try
    if (n >= 1) slug = `${base}-${org.id.slice(0, 6)}-${n}`;
  }

  const { error } = await sb.from('organizations').update({ slug }).eq('id', org.id);
  if (error) return null;
  return slug;
}
