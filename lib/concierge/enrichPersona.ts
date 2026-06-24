/**
 * Phase 146.1 — auto-enrich the Concierge persona from real data. SERVER-ONLY.
 *
 * Profiles carry no "specialties"/"bio" fields, so rather than make the LO type them,
 * we derive them from signals that already exist:
 *   • specialties/products → the loan types the LO actually works (their leads +
 *     their lender AE connections, P89), ranked by how often they appear.
 *   • application_url → the LO's branded Smart-1003 link (P137 buildApplyUrl from the
 *     org slug + the LO's application_slug).
 *
 * Only BLANK settings fields are filled — anything the LO typed wins. Never throws;
 * on any error it returns the settings unchanged. Adds DB reads only when a field is
 * actually blank, so once an LO saves explicit values there's zero extra cost.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApplyUrl } from '@/lib/tenant/applyLinks';
import type { ConciergeSettings } from '@/lib/concierge/types';

type Admin = SupabaseClient<any, any, any>;

const LABELS: Record<string, string> = {
  conventional: 'Conventional', conforming: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDA',
  jumbo: 'Jumbo', dscr: 'DSCR', heloc: 'HELOC', heloan: 'HELOAN', bank_statement: 'bank-statement',
  bank_stmt: 'bank-statement', non_qm: 'Non-QM', nonqm: 'Non-QM', reverse: 'reverse', construction: 'construction',
  commercial: 'commercial', '1099': '1099', refinance: 'refinances', cash_out: 'cash-out refinances',
};
const label = (raw: string): string => {
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return LABELS[k] ?? raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Top loan types the LO works, as a readable phrase, or null. */
export async function deriveSpecialties(sb: Admin, orgId: string, loId: string): Promise<string | null> {
  try {
    const counts = new Map<string, number>();
    const [{ data: leads }, { data: aes }] = await Promise.all([
      sb.from('leads').select('loan_type').eq('org_id', orgId).eq('assigned_to', loId).not('loan_type', 'is', null).order('created_at', { ascending: false }).limit(200),
      sb.from('lender_ae_connections').select('loan_types').eq('lo_id', loId).eq('is_active', true),
    ]);
    for (const r of (leads ?? []) as { loan_type: string | null }[]) {
      const lt = (r.loan_type ?? '').trim();
      if (lt) counts.set(lt, (counts.get(lt) ?? 0) + 1);
    }
    for (const r of (aes ?? []) as { loan_types: string[] | null }[]) {
      for (const lt of r.loan_types ?? []) {
        const v = (lt ?? '').trim();
        if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    if (!counts.size) return null;
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => label(k));
    // de-dupe labels that collapsed to the same display value
    const seen = new Set<string>();
    const uniq = top.filter((l) => (seen.has(l.toLowerCase()) ? false : (seen.add(l.toLowerCase()), true)));
    return uniq.join(', ');
  } catch {
    return null;
  }
}

/** The LO's branded apply URL (P137), or null. */
export async function deriveApplyUrl(sb: Admin, orgId: string, loId: string): Promise<string | null> {
  try {
    const [{ data: org }, { data: prof }] = await Promise.all([
      sb.from('organizations').select('slug').eq('id', orgId).maybeSingle(),
      sb.from('profiles').select('application_slug').eq('id', loId).maybeSingle(),
    ]);
    const orgSlug = (org as { slug: string | null } | null)?.slug;
    if (!orgSlug) return null;
    return buildApplyUrl(orgSlug, (prof as { application_slug: string | null } | null)?.application_slug ?? null);
  } catch {
    return null;
  }
}

/** Fill blank persona_specialties / products / application_url from real data. */
export async function enrichPersona(sb: Admin, orgId: string, loId: string | null, settings: ConciergeSettings): Promise<ConciergeSettings> {
  if (!loId) return settings;
  const needSpec = !settings.persona_specialties?.trim();
  const needProd = !settings.products?.trim();
  const needUrl = !settings.application_url?.trim();
  if (!needSpec && !needProd && !needUrl) return settings;

  const [specialties, applyUrl] = await Promise.all([
    needSpec || needProd ? deriveSpecialties(sb, orgId, loId) : Promise.resolve(null),
    needUrl ? deriveApplyUrl(sb, orgId, loId) : Promise.resolve(null),
  ]);

  return {
    ...settings,
    persona_specialties: needSpec && specialties ? specialties : settings.persona_specialties,
    products: needProd && specialties ? specialties : settings.products,
    application_url: needUrl && applyUrl ? applyUrl : settings.application_url,
  };
}
