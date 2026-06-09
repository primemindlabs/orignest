/**
 * Phase 33.2 — capture ad attribution from UTM / click-id params on lead intake.
 */

export interface LeadAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  platform?: 'meta' | 'google';
  campaign_id?: string;
}

export function inferPlatform(source?: string | null): 'meta' | 'google' | undefined {
  if (!source) return undefined;
  const s = source.toLowerCase();
  if (['facebook', 'instagram', 'fb', 'meta', 'ig'].includes(s)) return 'meta';
  if (['google', 'cpc', 'ppc', 'gads', 'adwords'].includes(s)) return 'google';
  return undefined;
}

/** From a URLSearchParams (landing page) or a plain object (API body). */
export function captureLeadAttribution(params: URLSearchParams | Record<string, unknown>): LeadAttribution {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = (params as Record<string, unknown>)[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const utm_source = get('utm_source');
  const fbclid = get('fbclid');
  const gclid = get('gclid');
  const platform = inferPlatform(utm_source) ?? (fbclid ? 'meta' : gclid ? 'google' : undefined);

  const attr: LeadAttribution = {
    utm_source,
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    platform,
    campaign_id: get('campaign_id') ?? get('utm_campaign'),
  };
  return attr;
}

/** True when there's at least one attribution signal worth recording. */
export function hasAttribution(a: LeadAttribution): boolean {
  return Boolean(a.utm_source || a.utm_medium || a.utm_campaign || a.platform || a.campaign_id);
}
