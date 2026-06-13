// Phase 118 — generate co-marketing copy (Claude Haiku) + a co-branded HTML preview,
// persisted to the existing co_marketing_materials. Design/PDF export (Canva/react-pdf)
// is gated — neither is available at app runtime; the HTML preview is print/shareable.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCopyPrompt, nmlsDisclaimer, MATERIAL_TYPES, type MaterialType, type CopyContext } from '@/lib/coMarketing/copyPrompts';

const MODEL = 'claude-haiku-4-5-20251001';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function previewHtml(opts: { brand: string; title: string; copy: string; loName: string; realtor: string | null; disclaimer: string }): string {
  return `<!doctype html><meta charset="utf-8"><div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;border:1px solid #eee;border-radius:14px;overflow:hidden">
<div style="background:${esc(opts.brand)};padding:18px 24px;color:#fff"><p style="margin:0;font-weight:700;font-size:18px">${esc(opts.title)}</p></div>
<div style="padding:24px;color:#222;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(opts.copy)}</div>
<div style="padding:0 24px 18px;color:#444;font-size:13px"><strong>${esc(opts.loName)}</strong>${opts.realtor ? ` &nbsp;×&nbsp; ${esc(opts.realtor)}` : ''}</div>
<div style="padding:12px 24px;border-top:1px solid #f0f0f0;color:#888;font-size:11px">${esc(opts.disclaimer)}</div></div>`;
}

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const materialType = b.materialType as MaterialType;
  if (!MATERIAL_TYPES.some((m) => m.id === materialType)) return NextResponse.json({ error: 'Invalid materialType' }, { status: 400 });

  const sb = createAdminClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, nmls_id').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
  ]);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  const loName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Your Loan Officer';

  let realtor: { first_name: string | null; last_name: string | null; brokerage_name: string | null } | null = null;
  if (b.realtorId) {
    const { data } = await sb.from('realtors').select('first_name, last_name, brokerage_name').eq('id', b.realtorId).eq('org_id', orgId).maybeSingle();
    realtor = data ?? null;
  }
  const { data: brand } = await sb.from('lo_brand_profiles').select('brand_color').eq('org_id', orgId).eq('user_id', profile.id).maybeSingle();
  const realtorName = realtor ? `${realtor.first_name ?? ''} ${realtor.last_name ?? ''}`.trim() : null;

  const ctx: CopyContext = {
    loName,
    loNmls: (profile.nmls_id as string | null) ?? null,
    realtorName,
    brokerage: realtor?.brokerage_name ?? null,
    propertyAddress: b.propertyAddress ?? null,
    openHouseDate: b.openHouseDate ?? null,
    customMessage: b.customMessage ?? null,
  };

  let copy = '';
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: buildCopyPrompt(materialType, ctx) }] });
    copy = res.content[0]?.type === 'text' ? res.content[0].text.trim() : '';
  } catch (e: any) {
    return NextResponse.json({ error: 'AI copy generation failed', detail: e?.message }, { status: 502 });
  }

  const disclaimer = nmlsDisclaimer(loName, (profile.nmls_id as string | null) ?? null, org?.name ?? null);
  const fullCopy = `${copy}\n\n${disclaimer}`;
  const label = MATERIAL_TYPES.find((m) => m.id === materialType)!.label;
  const html = previewHtml({ brand: brand?.brand_color ?? '#C9A95C', title: label, copy, loName, realtor: realtorName, disclaimer });

  const { data: material, error } = await sb
    .from('co_marketing_materials')
    .insert({
      org_id: orgId,
      created_by: profile.id,
      partner_id: b.realtorId ?? null,
      material_type: materialType,
      content: { copy: fullCopy, property_address: b.propertyAddress ?? null, open_house_date: b.openHouseDate ?? null, custom_message: b.customMessage ?? null },
      preview_html: html,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ materialId: material.id, copy: fullCopy, previewHtml: html });
}
