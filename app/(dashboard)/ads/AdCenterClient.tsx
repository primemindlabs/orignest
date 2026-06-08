'use client';

import { useState } from 'react';
import { Megaphone, Image as ImageIcon, Globe, Sparkles, Plus, ExternalLink, QrCode, Copy, Check, AlertCircle } from 'lucide-react';
import type { ReferralPartner, Profile } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = 'facebook' | 'google' | 'instagram' | 'linkedin';
type Goal = 'lead_generation' | 'brand_awareness' | 'refinance_push' | 'dscr_investor' | 'first_time_buyer';
type LoanTypeFocus = 'conventional' | 'fha' | 'dscr' | 'jumbo' | 'va';

interface AdCopyVariation {
  headline: string;
  body: string;
  cta: string;
}

interface AdCopyResult {
  variations: AdCopyVariation[];
  complianceFlag: boolean;
  complianceNote: string | null;
}

interface AdTemplate {
  id: string;
  category: string;
  headline: string;
  body: string;
  cta: string;
}

interface AdCenterClientProps {
  landingPages: Array<{
    id: string;
    slug: string;
    headline: string;
    active: boolean;
    page_views: number;
    leads_captured: number;
    created_at: string;
  }>;
  profiles: Profile[];
  orgSlug: string;
}

// ── Static data ────────────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'google', label: 'Google', color: '#4285F4' },
  { id: 'instagram', label: 'Instagram', color: '#E4405F' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
];

const GOALS: { id: Goal; label: string }[] = [
  { id: 'lead_generation', label: 'Lead Generation' },
  { id: 'brand_awareness', label: 'Brand Awareness' },
  { id: 'refinance_push', label: 'Refinance Push' },
  { id: 'dscr_investor', label: 'DSCR / Investor' },
  { id: 'first_time_buyer', label: 'First-Time Buyer' },
];

const LOAN_TYPES: { id: LoanTypeFocus; label: string }[] = [
  { id: 'conventional', label: 'Conventional' },
  { id: 'fha', label: 'FHA' },
  { id: 'va', label: 'VA' },
  { id: 'jumbo', label: 'Jumbo' },
  { id: 'dscr', label: 'DSCR' },
];

const AD_TEMPLATES: AdTemplate[] = [
  // Purchase
  { id: 'p1', category: 'Purchase', headline: 'Your Dream Home Is Closer Than You Think', body: 'Stop paying rent and start building equity. Our first-time buyer programs offer low down payment options with competitive rates.', cta: 'Get Pre-Qualified' },
  { id: 'p2', category: 'Purchase', headline: 'Ready to Move Up? We Can Help', body: 'Upgrade to the home your family deserves. Our move-up buyer specialists make the transition seamless.', cta: 'Explore Options' },
  { id: 'p3', category: 'Purchase', headline: 'New Construction Financing Made Simple', body: 'Builder preferred lender with fast approvals. Close on your new build with confidence.', cta: 'Get Started' },
  // Refinance
  { id: 'r1', category: 'Refinance', headline: 'Lower Your Monthly Payment Today', body: 'Market conditions may have created an opportunity to reduce your interest rate. Find out if refinancing makes sense for you.', cta: 'Check My Rate' },
  { id: 'r2', category: 'Refinance', headline: 'Access Your Home\'s Equity', body: 'Your home may have appreciated significantly. A cash-out refinance could fund renovations, education, or debt consolidation.', cta: 'Calculate My Equity' },
  { id: 'r3', category: 'Refinance', headline: 'Eliminate High-Interest Debt', body: 'Consolidate credit card debt into your mortgage at a fraction of the interest rate. Free up hundreds monthly.', cta: 'See My Savings' },
  // DSCR
  { id: 'd1', category: 'DSCR / Investor', headline: 'Qualify on Cash Flow, Not W-2s', body: 'DSCR loans for investors. No tax returns required. Qualify based on the property\'s rental income.', cta: 'Apply Now' },
  { id: 'd2', category: 'DSCR / Investor', headline: 'Grow Your Rental Portfolio', body: 'Financing designed for real estate investors. Multiple property financing with streamlined qualification.', cta: 'Talk to an Expert' },
  // Seasonal
  { id: 's1', category: 'Seasonal', headline: 'Spring Is Here — Is Your Pre-Approval?', body: 'Competition heats up in spring. Get pre-approved now and be ready to move fast on the right home.', cta: 'Get Pre-Approved' },
  { id: 's2', category: 'Seasonal', headline: 'Year-End Purchase Tax Advantages', body: 'Buying before December 31 may offer meaningful tax benefits. Let\'s run the numbers for your situation.', cta: 'Learn More' },
  // Educational
  { id: 'e1', category: 'Educational', headline: 'Credit Score Under 620? Here\'s Your Path', body: 'Many buyers don\'t realize FHA loans allow scores as low as 580. Let\'s explore your options today.', cta: 'Get a Free Consultation' },
  { id: 'e2', category: 'Educational', headline: 'Down Payment Assistance Programs in Your Area', body: 'You may qualify for grants and low-interest loans to cover your down payment. We\'ll find every dollar available.', cta: 'Check Eligibility' },
];

const TEMPLATE_CATEGORIES = [...new Set(AD_TEMPLATES.map(t => t.category))];

// ── Campaign Builder Tab ───────────────────────────────────────────────────────

function CampaignBuilder() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loanType, setLoanType] = useState<LoanTypeFocus | null>(null);
  const [states, setStates] = useState('');
  const [ageMin, setAgeMin] = useState('25');
  const [ageMax, setAgeMax] = useState('65');
  const [dailyBudget, setDailyBudget] = useState('');
  const [duration, setDuration] = useState('30');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdCopyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!platform || !goal || !loanType) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          goal,
          loanType,
          targetAudience: {
            states: states ? states.split(',').map(s => s.trim()) : [],
            ageRange: { min: parseInt(ageMin), max: parseInt(ageMax) },
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to generate ad copy');
      }

      const data = await res.json() as AdCopyResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const canGenerate = platform && goal && loanType;

  return (
    <div className="space-y-6">
      {/* Platform */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-3">Platform</label>
        <div className="flex gap-2 flex-wrap">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                platform === p.id
                  ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]'
                  : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-3">Campaign Goal</label>
        <div className="flex gap-2 flex-wrap">
          {GOALS.map(g => (
            <button
              key={g.id}
              onClick={() => setGoal(g.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                goal === g.id
                  ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]'
                  : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loan Type */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-3">Loan Type Focus</label>
        <div className="flex gap-2 flex-wrap">
          {LOAN_TYPES.map(l => (
            <button
              key={l.id}
              onClick={() => setLoanType(l.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                loanType === l.id
                  ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]'
                  : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audience */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">
            Target States <span className="font-normal text-[#8A8A8E]">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={states}
            onChange={e => setStates(e.target.value)}
            placeholder="FL, GA, TX"
            className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] text-[#1C1C1E] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
          />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">Age Range</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={ageMin}
              onChange={e => setAgeMin(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] text-center focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
            />
            <span className="text-[#8A8A8E] text-sm">–</span>
            <input
              type="number"
              value={ageMax}
              onChange={e => setAgeMax(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] text-center focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
            />
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">Daily Budget ($)</label>
          <input
            type="number"
            value={dailyBudget}
            onChange={e => setDailyBudget(e.target.value)}
            placeholder="50"
            className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
          />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">Duration (days)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="30"
            className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A95C] text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0066CC] transition-colors"
      >
        <Sparkles size={15} />
        {loading ? 'Generating…' : 'Generate AI Ad Copy'}
      </button>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20">
          <AlertCircle size={15} className="text-[#FF3B30] mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-[#FF3B30]">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.complianceFlag && result.complianceNote && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20">
              <AlertCircle size={15} className="text-[#FF9500] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-[#FF9500]">{result.complianceNote}</p>
            </div>
          )}

          {result.variations.map((v, idx) => (
            <div key={idx} className="bg-white border border-black/[0.06] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">
                  Variation {idx + 1}
                </span>
                <button
                  onClick={() => handleCopy(`${v.headline}\n\n${v.body}\n\nCTA: ${v.cta}`, idx)}
                  className="flex items-center gap-1 text-[12px] text-[#C9A95C] hover:text-[#0066CC]"
                >
                  {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                  {copiedIdx === idx ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[15px] font-semibold text-[#1C1C1E]">{v.headline}</p>
              <p className="text-[13px] text-[#3C3C43] leading-relaxed">{v.body}</p>
              <div className="inline-block px-3 py-1 rounded-lg bg-[#C9A95C] text-white text-[12px] font-semibold">
                {v.cta}
              </div>
            </div>
          ))}

          {result.complianceNote && (
            <p className="text-[11px] text-[#8A8A8E] italic px-1">
              {result.complianceNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Creative Library Tab ───────────────────────────────────────────────────────

function CreativeLibrary() {
  const [activeCategory, setActiveCategory] = useState<string>(TEMPLATE_CATEGORIES[0] ?? 'Purchase');
  const [selectedTemplate, setSelectedTemplate] = useState<AdTemplate | null>(null);

  const filtered = AD_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category pills */}
      <div className="flex gap-2 flex-wrap">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
              activeCategory === cat
                ? 'bg-[#C9A95C] text-white'
                : 'bg-white border border-black/[0.10] text-[#3C3C43] hover:bg-[#F2F2F7]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map(template => (
          <div
            key={template.id}
            className={`bg-white border rounded-2xl p-4 space-y-2.5 cursor-pointer transition-all ${
              selectedTemplate?.id === template.id
                ? 'border-[#C9A95C] shadow-[0_0_0_3px_rgba(0,122,255,0.12)]'
                : 'border-black/[0.06] hover:border-black/[0.12] shadow-sm'
            }`}
            onClick={() => setSelectedTemplate(template)}
          >
            {/* Placeholder preview */}
            <div className="h-24 rounded-xl bg-gradient-to-br from-[#F2F2F7] to-[#E5E5EA] flex items-center justify-center">
              <ImageIcon size={24} className="text-[#C7C7CC]" />
            </div>
            <p className="text-[13px] font-semibold text-[#1C1C1E] leading-snug">{template.headline}</p>
            <p className="text-[12px] text-[#6B6B70] leading-relaxed line-clamp-2">{template.body}</p>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 rounded-lg bg-[#C9A95C] text-white text-[12px] font-semibold hover:bg-[#0066CC] transition-colors">
                Use Template
              </button>
              <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/[0.10] text-[12px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors">
                <Sparkles size={11} />
                AI
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="bg-white border border-[#C9A95C] rounded-2xl p-5 space-y-3">
          <p className="text-[11px] font-semibold text-[#C9A95C] uppercase tracking-wide">Selected Template</p>
          <p className="text-[16px] font-bold text-[#1C1C1E]">{selectedTemplate.headline}</p>
          <p className="text-[13px] text-[#3C3C43] leading-relaxed">{selectedTemplate.body}</p>
          <div className="inline-block px-4 py-1.5 rounded-lg bg-[#C9A95C] text-white text-[13px] font-semibold">
            {selectedTemplate.cta}
          </div>
          <p className="text-[11px] text-[#8A8A8E] italic">
            Not a commitment to lend. Subject to credit approval.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Landing Pages Tab ──────────────────────────────────────────────────────────

function LandingPagesTab({ landingPages, profiles }: { landingPages: AdCenterClientProps['landingPages']; profiles: Profile[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleCopyUrl = (slug: string) => {
    void navigator.clipboard.writeText(`https://ashleyiq.app/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#6B6B70]">{landingPages.length} landing {landingPages.length === 1 ? 'page' : 'pages'}</p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] transition-colors"
        >
          <Plus size={14} />
          Create Landing Page
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-5 space-y-4">
          <p className="text-[15px] font-semibold text-[#1C1C1E]">New Landing Page</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#1C1C1E] mb-1.5">Loan Officer</label>
              <select className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]">
                <option value="">Select LO…</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#1C1C1E] mb-1.5">Page Slug</label>
              <div className="flex items-center">
                <span className="h-10 px-3 flex items-center text-[13px] text-[#8A8A8E] bg-[#F2F2F7] rounded-l-xl border border-r-0 border-black/[0.10]">ashleyiq.app/</span>
                <input
                  type="text"
                  placeholder="john-smith"
                  className="flex-1 h-10 px-3 rounded-r-xl border border-black/[0.10] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#1C1C1E] mb-1.5">Headline</label>
            <input
              type="text"
              placeholder="Get Pre-Qualified in Minutes"
              className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#1C1C1E] mb-1.5">Subheadline</label>
            <input
              type="text"
              placeholder="Expert mortgage guidance for your home purchase or refinance"
              className="w-full h-10 px-3 rounded-xl border border-black/[0.10] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl border border-black/[0.10] text-[13px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
            >
              Cancel
            </button>
            <button className="px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] transition-colors">
              Create Page
            </button>
          </div>
        </div>
      )}

      {landingPages.length === 0 && !showCreate ? (
        <div className="text-center py-16 bg-white border border-black/[0.06] shadow-sm rounded-2xl">
          <Globe size={32} className="text-[#C7C7CC] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[#1C1C1E] mb-1">No landing pages yet</p>
          <p className="text-[13px] text-[#8A8A8E] mb-4">Create a personalized landing page for each loan officer</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] transition-colors"
          >
            Create Your First Page
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {landingPages.map(page => (
            <div key={page.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[14px] font-semibold text-[#1C1C1E] truncate">{page.headline}</p>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      page.active ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-[#8A8A8E]/15 text-[#8A8A8E]'
                    }`}>
                      {page.active ? 'Live' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#C9A95C] font-mono">ashleyiq.app/{page.slug}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[12px] text-[#8A8A8E]">{page.page_views.toLocaleString()} views</span>
                    <span className="text-[12px] text-[#8A8A8E]">{page.leads_captured} leads</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleCopyUrl(page.slug)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black/[0.10] text-[12px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
                  >
                    {copiedSlug === page.slug ? <Check size={12} /> : <Copy size={12} />}
                    {copiedSlug === page.slug ? 'Copied' : 'Copy URL'}
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black/[0.10] text-[12px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors">
                    <QrCode size={12} />
                    QR
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black/[0.10] text-[12px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors">
                    <ExternalLink size={12} />
                    Preview
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────────

type Tab = 'builder' | 'creative' | 'landing';

export function AdCenterClient({ landingPages, profiles }: AdCenterClientProps) {
  const [tab, setTab] = useState<Tab>('builder');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'builder', label: 'Campaign Builder', icon: <Megaphone size={14} /> },
    { id: 'creative', label: 'Ad Creative Library', icon: <ImageIcon size={14} /> },
    { id: 'landing', label: 'Landing Pages', icon: <Globe size={14} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#E5E5EA] rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-[#1C1C1E] shadow-sm'
                : 'text-[#3C3C43] hover:text-[#1C1C1E]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'builder' && <CampaignBuilder />}
      {tab === 'creative' && <CreativeLibrary />}
      {tab === 'landing' && <LandingPagesTab landingPages={landingPages} profiles={profiles} />}
    </div>
  );
}
