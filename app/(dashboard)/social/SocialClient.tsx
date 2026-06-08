'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Copy, Check, AlertCircle, Clock, Hash,
  BookOpen, Calendar, Plus, Trash2, Inbox, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = 'linkedin' | 'instagram' | 'facebook' | 'twitter';
type Tone = 'professional' | 'conversational' | 'educational';

type ContentType =
  | 'rate_update'
  | 'market_insight'
  | 'client_win'
  | 'educational_tip'
  | 'first_time_buyer_tip'
  | 'dscr_investor'
  | 'holiday_post';

interface GeneratedPost {
  body: string;
  hashtags: string[];
  complianceFlag: boolean;
  complianceNote: string | null;
  bestTimeToPost: string;
}

interface SavedPost {
  id: string;
  platform: Platform;
  content_type: string;
  body: string;
  hashtags: string[];
  status: 'draft' | 'scheduled' | 'posted';
  scheduled_at: string | null;
  compliance_flag: boolean;
  created_at: string;
}

interface SocialClientProps {
  savedPosts: SavedPost[];
}

// ── Static config ──────────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; color: string; charLimit: number }[] = [
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', charLimit: 3000 },
  { id: 'instagram', label: 'Instagram', color: '#E4405F', charLimit: 2200 },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', charLimit: 2000 },
  { id: 'twitter', label: 'X / Twitter', color: '#000000', charLimit: 280 },
];

const CONTENT_TYPES: { id: ContentType; label: string }[] = [
  { id: 'rate_update', label: 'Rate Update' },
  { id: 'market_insight', label: 'Market Insight' },
  { id: 'client_win', label: 'Client Win (Anonymized)' },
  { id: 'educational_tip', label: 'Educational Tip' },
  { id: 'first_time_buyer_tip', label: 'First-Time Buyer Tip' },
  { id: 'dscr_investor', label: 'DSCR / Investor Content' },
  { id: 'holiday_post', label: 'Holiday Post' },
];

const TONES: { id: Tone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'conversational', label: 'Conversational' },
  { id: 'educational', label: 'Educational' },
];

const STATUS_COLORS: Record<SavedPost['status'], string> = {
  draft: 'bg-[#8A8A8E]/15 text-[#8A8A8E]',
  scheduled: 'bg-[#FF9500]/15 text-[#FF9500]',
  posted: 'bg-[#34C759]/15 text-[#34C759]',
};

// ── Content Generator ──────────────────────────────────────────────────────────

function ContentGenerator({ onSave }: { onSave: (post: SavedPost) => void }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [tone, setTone] = useState<Tone>('professional');
  const [includeRate, setIncludeRate] = useState(false);
  const [includeMarket, setIncludeMarket] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedPlatform = PLATFORMS.find(p => p.id === platform);

  const handleGenerate = async () => {
    if (!platform || !contentType) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/social-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, contentType, tone, includeRate, includeMarket }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Generation failed');
      }

      setResult(await res.json() as GeneratedPost);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `${result.body}\n\n${result.hashtags.map(h => `#${h}`).join(' ')}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!result || !platform || !contentType) return;
    setSaving(true);
    try {
      const res = await fetch('/api/social/save-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, contentType, tone, body: result.body, hashtags: result.hashtags, complianceFlag: result.complianceFlag }),
      });
      if (res.ok) {
        const saved = await res.json() as SavedPost;
        onSave(saved);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const charCount = result?.body.length ?? 0;
  const charLimit = selectedPlatform?.charLimit ?? 2000;

  return (
    <div className="space-y-5">
      {/* Platform */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-2.5">Platform</label>
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

      {/* Content type */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-2.5">Content Type</label>
        <div className="flex gap-2 flex-wrap">
          {CONTENT_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setContentType(ct.id)}
              className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium border transition-all ${
                contentType === ct.id
                  ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]'
                  : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-[13px] font-semibold text-[#1C1C1E] mb-2.5">Tone</label>
        <div className="flex gap-2">
          {TONES.map(t => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                tone === t.id
                  ? 'border-[#C9A95C] bg-[#C9A95C]/10 text-[#C9A95C]'
                  : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setIncludeRate(!includeRate)}
            className={`w-10 h-6 rounded-full transition-colors relative ${includeRate ? 'bg-[#C9A95C]' : 'bg-[#E5E5EA]'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeRate ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-[13px] text-[#1C1C1E]">Mention current rates</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setIncludeMarket(!includeMarket)}
            className={`w-10 h-6 rounded-full transition-colors relative ${includeMarket ? 'bg-[#C9A95C]' : 'bg-[#E5E5EA]'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeMarket ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-[13px] text-[#1C1C1E]">Include market context</span>
        </label>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!platform || !contentType || loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A95C] text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0066CC] transition-colors"
      >
        <Sparkles size={15} />
        {loading ? 'Generating…' : 'Generate Post'}
      </button>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20">
          <AlertCircle size={15} className="text-[#FF3B30] mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-[#FF3B30]">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-white border border-black/[0.06] rounded-2xl p-5 space-y-4">
          {result.complianceFlag && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20">
              <AlertCircle size={14} className="text-[#FF9500] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-[#FF9500]">{result.complianceNote}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Post Copy</span>
              <span className={`text-[11px] font-mono ${charCount > charLimit ? 'text-[#FF3B30]' : 'text-[#8A8A8E]'}`}>
                {charCount}/{charLimit}
              </span>
            </div>
            <p className="text-[14px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{result.body}</p>
          </div>

          {result.hashtags.length > 0 && (
            <div className="flex items-start gap-2">
              <Hash size={13} className="text-[#C9A95C] mt-0.5 flex-shrink-0" />
              <div className="flex gap-1.5 flex-wrap">
                {result.hashtags.map(tag => (
                  <span key={tag} className="text-[13px] text-[#C9A95C]">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {result.bestTimeToPost && (
            <div className="flex items-center gap-2 text-[12px] text-[#8A8A8E]">
              <Clock size={12} />
              Best time: {result.bestTimeToPost}
            </div>
          )}

          {result.complianceNote && !result.complianceFlag && (
            <p className="text-[11px] text-[#8A8A8E] italic">{result.complianceNote}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-black/[0.10] text-[13px] text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Post'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-[13px] font-semibold hover:bg-[#0066CC] disabled:opacity-40 transition-colors"
            >
              {saved ? <Check size={13} /> : <BookOpen size={13} />}
              {saved ? 'Saved!' : saving ? 'Saving…' : 'Save to Library'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Content Library ────────────────────────────────────────────────────────────

function ContentLibrary({ posts }: { posts: SavedPost[] }) {
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');

  const filtered = filterPlatform === 'all' ? posts : posts.filter(p => p.platform === filterPlatform);

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen size={32} className="text-[#C7C7CC] mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-[#1C1C1E] mb-1">No saved posts yet</p>
        <p className="text-[13px] text-[#8A8A8E]">Generate content and save it to your library</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setFilterPlatform('all')}
          className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium border transition-all ${
            filterPlatform === 'all' ? 'bg-[#C9A95C] text-white border-[#C9A95C]' : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
          }`}
        >
          All
        </button>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => setFilterPlatform(p.id)}
            className={`px-3.5 py-1.5 rounded-xl text-[13px] font-medium border transition-all ${
              filterPlatform === p.id ? 'bg-[#C9A95C] text-white border-[#C9A95C]' : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(post => (
          <div key={post.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase">
                  {PLATFORMS.find(p => p.id === post.platform)?.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[post.status]}`}>
                  {post.status}
                </span>
                {post.compliance_flag && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF9500]/15 text-[#FF9500]">
                    Review
                  </span>
                )}
              </div>
              <button className="text-[#FF3B30] hover:text-[#CC0000] transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-[13px] text-[#1C1C1E] leading-relaxed line-clamp-3">{post.body}</p>
            {post.hashtags.length > 0 && (
              <p className="text-[12px] text-[#C9A95C] mt-1.5">
                {post.hashtags.map(h => `#${h}`).join(' ')}
              </p>
            )}
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px] text-[#C7C7CC]">
                {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              <button className="text-[12px] text-[#C9A95C] font-medium hover:text-[#0066CC]">
                Reuse
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Content Calendar ───────────────────────────────────────────────────────────

function ContentCalendar({ posts }: { posts: SavedPost[] }) {
  const scheduled = posts.filter(p => p.status === 'scheduled' && p.scheduled_at);

  return (
    <div className="space-y-4">
      {scheduled.length === 0 ? (
        <div className="text-center py-16">
          <Calendar size={32} className="text-[#C7C7CC] mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[#1C1C1E] mb-1">No scheduled posts</p>
          <p className="text-[13px] text-[#8A8A8E]">Schedule posts from the Content Generator or Library</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduled.map(post => (
            <div key={post.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-12 text-center">
                <p className="text-[11px] font-semibold text-[#8A8A8E] uppercase">
                  {post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString('en-US', { month: 'short' }) : '—'}
                </p>
                <p className="text-[20px] font-bold text-[#1C1C1E] leading-none">
                  {post.scheduled_at ? new Date(post.scheduled_at).getDate() : '—'}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase">
                    {PLATFORMS.find(p => p.id === post.platform)?.label}
                  </span>
                  <span className="text-[11px] text-[#C7C7CC]">
                    {post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-[13px] text-[#1C1C1E] leading-relaxed line-clamp-2">{post.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'generator' | 'calendar' | 'library' | 'pending_review';

export function SocialClient({ savedPosts: initialPosts }: SocialClientProps) {
  const [tab, setTab] = useState<Tab>('generator');
  const [posts, setPosts] = useState<SavedPost[]>(initialPosts);
  const [pendingCount, setPendingCount] = useState(0);

  const handleSave = (post: SavedPost) => {
    setPosts(prev => [post, ...prev]);
  };

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/social/proof?status=pending_review');
      if (res.ok) {
        const j = (await res.json()) as { posts: unknown[] };
        setPendingCount(j.posts?.length ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { void refreshPendingCount(); }, [refreshPendingCount]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'generator', label: 'Content Generator', icon: <Sparkles size={14} /> },
    { id: 'calendar', label: 'Content Calendar', icon: <Calendar size={14} /> },
    { id: 'library', label: 'Content Library', icon: <BookOpen size={14} /> },
    { id: 'pending_review', label: 'Pending Review', icon: <Inbox size={14} />, badge: pendingCount },
  ];

  return (
    <div className="space-y-5">
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
            {t.badge ? (
              <span className="ml-0.5 text-[10px] font-bold rounded-full bg-blue text-white px-1.5 py-0.5 leading-none">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'generator' && <ContentGenerator onSave={handleSave} />}
      {tab === 'calendar' && <ContentCalendar posts={posts} />}
      {tab === 'library' && <ContentLibrary posts={posts} />}
      {tab === 'pending_review' && <PendingReviewTab onChange={refreshPendingCount} />}
    </div>
  );
}

// ── Pending Review (social-proof automation) ────────────────────────────────────

interface ProofPost {
  id: string;
  status: string;
  instagram_caption: string | null;
  facebook_caption: string | null;
  linkedin_caption: string | null;
  nps_score: number | null;
  created_at: string;
  leads: { first_name: string } | null;
}

function PendingReviewTab({ onChange }: { onChange: () => void }) {
  const [posts, setPosts] = useState<ProofPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, ProofPost>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/social/proof?status=pending_review');
    if (res.ok) {
      const j = (await res.json()) as { posts: ProofPost[] };
      setPosts(j.posts ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(post: ProofPost, status: string) {
    const edited = editing[post.id];
    await fetch('/api/social/proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: post.id,
        status,
        ...(edited ? {
          instagram_caption: edited.instagram_caption,
          facebook_caption: edited.facebook_caption,
          linkedin_caption: edited.linkedin_caption,
        } : {}),
      }),
    });
    setPosts(prev => prev.filter(p => p.id !== post.id));
    onChange();
  }

  function updateCaption(post: ProofPost, field: keyof ProofPost, value: string) {
    setEditing(prev => ({ ...prev, [post.id]: { ...(prev[post.id] ?? post), [field]: value } }));
  }

  if (loading) return <p className="text-sm text-[#8A8A8E] py-8 text-center">Loading…</p>;
  if (posts.length === 0) {
    return (
      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-5 py-12 text-center">
        <Inbox size={22} className="text-[#C7C7CC] mx-auto mb-2" />
        <p className="text-sm font-medium text-[#1C1C1E]">No posts awaiting review</p>
        <p className="text-xs text-[#8A8A8E] mt-1">When a client gives a 9 or 10 NPS score, Ashley drafts celebration posts here for your approval.</p>
      </div>
    );
  }

  const PLATFORMS: Array<{ key: keyof ProofPost; label: string }> = [
    { key: 'instagram_caption', label: 'Instagram' },
    { key: 'facebook_caption', label: 'Facebook' },
    { key: 'linkedin_caption', label: 'LinkedIn' },
  ];

  return (
    <div className="space-y-4">
      {posts.map(post => {
        const current = editing[post.id] ?? post;
        return (
          <div key={post.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#1C1C1E]">
                {post.leads?.first_name ?? 'Client'} closing
                {post.nps_score ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green/15 text-green">NPS {post.nps_score}</span> : null}
              </p>
              <span className="text-[11px] text-[#8A8A8E]">{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <div className="space-y-3">
              {PLATFORMS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide mb-1">{label}</p>
                  <textarea
                    value={(current[key] as string | null) ?? ''}
                    onChange={(e) => updateCaption(post, key, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-[8px] border border-black/[0.10] bg-[#F2F2F7] text-[13px] resize-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => act(post, 'approved')} className="flex items-center gap-1.5 px-4 py-2 bg-blue text-white text-[13px] font-semibold rounded-xl hover:bg-blue/90 transition-colors">
                <Check size={14} /> Approve &amp; Schedule
              </button>
              <button onClick={() => act(post, 'rejected')} className="flex items-center gap-1.5 px-4 py-2 border border-black/[0.10] bg-white text-[#3C3C43] text-[13px] font-medium rounded-xl hover:bg-[#F2F2F7] transition-colors">
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
