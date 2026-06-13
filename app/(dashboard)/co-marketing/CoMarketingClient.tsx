'use client';

import { useState } from 'react';
import {
  FileText, Users, Download, Eye, AlertCircle, Sparkles, Copy, Check,
} from 'lucide-react';
import type { ReferralPartner, Profile } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type MaterialType = 'rate_sheet' | 'open_house_flyer' | 'just_closed_post' | 'buyers_guide' | 'email_signature';

interface RateSheetResult {
  html: string;
  partnerName: string;
  loName: string;
}

interface CoMarketingClientProps {
  partners: ReferralPartner[];
  profiles: Profile[];
}

// ── Static config ──────────────────────────────────────────────────────────────

const MATERIAL_TYPES: { id: MaterialType; label: string; description: string }[] = [
  { id: 'rate_sheet', label: 'Rate Sheet', description: 'Current indicative rates with both contacts' },
  { id: 'open_house_flyer', label: 'Open House Flyer', description: 'Property address + pre-qual info' },
  { id: 'just_closed_post', label: '"Just Closed" Social Post', description: 'Anonymized buyer win post' },
  { id: 'buyers_guide', label: "Buyer's Guide PDF", description: 'Co-branded cover page' },
  { id: 'email_signature', label: 'Email Signature', description: 'HTML template with both contacts' },
];

// ── Rate Sheet Preview ─────────────────────────────────────────────────────────

function RateSheetPreview({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[740px] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <p className="text-[15px] font-semibold text-[#1C1C1E]">Rate Sheet Preview</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'rate-sheet.html';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] transition-colors"
            >
              <Download size={13} />
              Download
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-black/[0.10] text-[13px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <iframe
            srcDoc={html}
            className="w-full h-[600px] rounded-xl border border-black/[0.06]"
            title="Rate Sheet Preview"
          />
        </div>
      </div>
    </div>
  );
}

// ── Email Signature Generator ──────────────────────────────────────────────────

function EmailSignatureGenerator({ partner, lo }: { partner: ReferralPartner; lo: Profile }) {
  const [copied, setCopied] = useState(false);

  const html = `<table cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1C1C1E;">
  <tr>
    <td style="padding-right:20px;border-right:2px solid #C9A95C;vertical-align:top;">
      <strong style="font-size:14px;display:block;margin-bottom:2px;">${lo.first_name} ${lo.last_name}</strong>
      <span style="color:#8A8A8E;display:block;">Mortgage Loan Officer</span>
      ${lo.nmls_id ? `<span style="color:#8A8A8E;display:block;">NMLS #${lo.nmls_id}</span>` : ''}
      <a href="mailto:${lo.email}" style="color:#C9A95C;text-decoration:none;display:block;margin-top:4px;">${lo.email}</a>
      ${lo.phone ? `<span style="color:#3C3C43;display:block;">${lo.phone}</span>` : ''}
    </td>
    <td style="padding-left:20px;vertical-align:top;">
      <strong style="font-size:14px;display:block;margin-bottom:2px;">${partner.first_name} ${partner.last_name}</strong>
      <span style="color:#8A8A8E;display:block;">${partner.company_name}</span>
      ${partner.license_number ? `<span style="color:#8A8A8E;display:block;">Lic. #${partner.license_number}</span>` : ''}
      <a href="mailto:${partner.email}" style="color:#C9A95C;text-decoration:none;display:block;margin-top:4px;">${partner.email}</a>
      ${partner.phone ? `<span style="color:#3C3C43;display:block;">${partner.phone}</span>` : ''}
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding-top:12px;font-size:10px;color:#8A8A8E;border-top:1px solid #E5E5EA;margin-top:12px;">
      Not a commitment to lend. Subject to credit approval. Equal Housing Lender.
    </td>
  </tr>
</table>`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="bg-[#F2F2F7] rounded-xl p-4">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] transition-colors"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied HTML' : 'Copy HTML'}
        </button>
      </div>
    </div>
  );
}

// ── Just Closed Post Generator ─────────────────────────────────────────────────

function JustClosedGenerator({ partner, lo }: { partner: ReferralPartner; lo: Profile }) {
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/social-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'linkedin',
          contentType: 'client_win',
          tone: 'professional',
          includeRate: false,
          includeMarket: false,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { body: string };
        // Personalize with partner co-branding
        const personalized = `${data.body}\n\n🏡 Another happy homeowner, made possible with the incredible partnership of ${partner.first_name} ${partner.last_name} at ${partner.company_name} and ${lo.first_name} ${lo.last_name}.\n\n#TeamWork #MortgageSuccess`;
        setPost(personalized);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!post) return;
    void navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] disabled:opacity-40 transition-colors"
      >
        <Sparkles size={13} />
        {loading ? 'Generating…' : 'Generate Post'}
      </button>

      {post && (
        <div className="bg-white border border-black/[0.06] rounded-xl p-4 space-y-3">
          <p className="text-[13px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{post}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/[0.10] text-[13px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy Post'}
          </button>
          <p className="text-[11px] text-[#8A8A8E] italic">
            Not a commitment to lend. Subject to credit approval.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Co-Branded Materials Generator ────────────────────────────────────────────

function MaterialsGenerator({ partners, profiles }: CoMarketingClientProps) {
  const [selectedPartner, setSelectedPartner] = useState<string>('');
  const [selectedLo, setSelectedLo] = useState<string>('');
  const [materialType, setMaterialType] = useState<MaterialType | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const partner = partners.find(p => p.id === selectedPartner);
  const lo = profiles.find(p => p.id === selectedLo);

  const handleGenerate = async () => {
    if (!selectedPartner || !selectedLo || !materialType) return;
    setLoading(true);
    setError(null);

    try {
      if (materialType === 'rate_sheet') {
        const res = await fetch('/api/co-marketing/rate-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partnerId: selectedPartner, loId: selectedLo }),
        });
        if (!res.ok) throw new Error('Failed to generate rate sheet');
        const data = await res.json() as RateSheetResult;
        setPreviewHtml(data.html);
      } else {
        setError(`${MATERIAL_TYPES.find(m => m.id === materialType)?.label} generation coming soon.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = selectedPartner && selectedLo && materialType;

  return (
    <div className="space-y-5">
      {/* Partner + LO selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">Referral Partner</label>
          {partners.length === 0 ? (
            <div className="p-3 rounded-xl bg-[#F2F2F7] text-[13px] text-[#8A8A8E]">
              No partners yet — add referral partners first.
            </div>
          ) : (
            <select
              value={selectedPartner}
              onChange={e => setSelectedPartner(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
            >
              <option value="">Select partner…</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} — {p.company_name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">Loan Officer</label>
          <select
            value={selectedLo}
            onChange={e => setSelectedLo(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
          >
            <option value="">Select LO…</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Material type selector */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-2.5">Material Type</label>
        <div className="grid grid-cols-2 gap-2">
          {MATERIAL_TYPES.map(m => (
            <button
              key={m.id}
              onClick={() => setMaterialType(m.id)}
              className={`text-left px-4 py-3 rounded-xl border transition-all ${
                materialType === m.id
                  ? 'border-[#C9A95C] bg-[#C9A95C]/10'
                  : 'border-black/[0.10] bg-white hover:bg-[#F2F2F7]'
              }`}
            >
              <p className={`text-[13px] font-semibold ${materialType === m.id ? 'text-[#C9A95C]' : 'text-[#1C1C1E]'}`}>
                {m.label}
              </p>
              <p className="text-[11px] text-[#8A8A8E] mt-0.5">{m.description}</p>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A95C] text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0066CC] transition-colors"
      >
        <FileText size={15} />
        {loading ? 'Generating…' : 'Preview & Download'}
      </button>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20">
          <AlertCircle size={15} className="text-[#FF9500] mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-[#FF9500]">{error}</p>
        </div>
      )}

      {/* Inline content for email sig / just closed */}
      {materialType === 'email_signature' && partner && lo && (
        <EmailSignatureGenerator partner={partner} lo={lo} />
      )}

      {materialType === 'just_closed_post' && partner && lo && (
        <JustClosedGenerator partner={partner} lo={lo} />
      )}

      {previewHtml && (
        <RateSheetPreview html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}
    </div>
  );
}

// ── Shared Landing Pages Section ───────────────────────────────────────────────

function SharedLandingPages({ partners, profiles }: CoMarketingClientProps) {
  if (partners.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={32} className="text-[#C7C7CC] mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-[#1C1C1E] mb-1">No referral partners yet</p>
        <p className="text-[13px] text-[#8A8A8E] mb-4">Add partners in the Partners section to create co-branded pages</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#8A8A8E]">
        Each co-branded page lives at <code className="text-[12px] bg-[#F2F2F7] px-1.5 py-0.5 rounded-md">ashleyiq.app/[lo-slug]/[realtor-slug]</code>.
        Leads captured route to the LO&apos;s pipeline. Partners see their own portal view.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {partners.slice(0, 6).map(partner => {
          const lo = profiles[0];
          const loSlug = lo ? `${lo.first_name}-${lo.last_name}`.toLowerCase().replace(/\s+/g, '-') : 'lo';
          const partnerSlug = `${partner.first_name}-${partner.last_name}`.toLowerCase().replace(/\s+/g, '-');

          return (
            <div key={partner.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-[13px] font-semibold text-[#1C1C1E]">
                    {partner.first_name} {partner.last_name}
                  </p>
                  <p className="text-[11px] text-[#8A8A8E]">{partner.company_name}</p>
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-[#34C759]/15 text-[#34C759] text-[10px] font-semibold">
                  Active
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#C9A95C] truncate">
                ashleyiq.app/{loSlug}/{partnerSlug}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[11px] text-[#8A8A8E]">{partner.referral_count} referrals</span>
                <span className="text-[11px] text-[#8A8A8E]">{partner.closed_count} closed</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex items-center gap-1 flex-1 justify-center py-1.5 rounded-lg border border-black/[0.10] text-[12px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors">
                  <Eye size={11} />
                  Preview
                </button>
                <button className="flex items-center gap-1 flex-1 justify-center py-1.5 rounded-lg bg-[#C9A95C] text-white text-[12px] font-semibold hover:bg-[#0066CC] transition-colors">
                  <Copy size={11} />
                  Copy URL
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'materials' | 'landing';

export function CoMarketingClient({ partners, profiles }: CoMarketingClientProps) {
  const [tab, setTab] = useState<Tab>('materials');

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-[#E5E5EA] rounded-xl w-fit">
        {[
          { id: 'materials' as Tab, label: 'Co-Branded Materials', icon: <FileText size={14} /> },
          { id: 'landing' as Tab, label: 'Shared Landing Pages', icon: <Users size={14} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
              tab === t.id ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#3C3C43] hover:text-[#1C1C1E]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'materials' && <MaterialsGenerator partners={partners} profiles={profiles} />}
      {tab === 'landing' && <SharedLandingPages partners={partners} profiles={profiles} />}
    </div>
  );
}
