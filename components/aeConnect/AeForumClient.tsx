'use client';

/**
 * Phase 89b — AE Forum. Branch (org) Q&A board built on the Phase 89 AE directory.
 * Two panes: question list + thread. Live via polling (Realtime is inert under Clerk).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Plus, MessageCircle, Clock, Send, Star, Check, Users, Mail, Eye } from 'lucide-react';
import { categoryMeta, FORUM_CATEGORIES } from '@/lib/aeForum/categories';
import { PostQuestionModal } from '@/components/aeConnect/PostQuestionModal';

interface FeedPost {
  id: string; posted_by: string; category: string; title: string; body: string | null;
  notified_ae_ids: string[]; is_resolved: boolean; best_response_id: string | null;
  created_at: string; response_count: number; last_activity: string; unread: boolean;
  responder_names: string[]; poster_name: string;
}
interface Response {
  id: string; body: string; source: string; created_at: string; lender_ae_id: string | null;
  ae_name: string | null; star_count: number; user_starred: boolean;
  lender_ae: { ae_name: string | null; lender_name: string | null; ae_title: string | null } | null;
}
interface Comment { id: string; body: string; created_at: string; author: { first_name: string | null; last_name: string | null } | null }
interface Thread {
  post: FeedPost & { poster_name: string };
  responses: Response[]; comments: Comment[]; branch_member_count: number; is_author: boolean; me: string;
}
interface AE { id: string; ae_name: string; lender_name: string }

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function CategoryBadge({ category }: { category: string }) {
  const c = categoryMeta(category);
  return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: c.tone, background: 'var(--c-fill)' }}>{c.label}</span>;
}

export function AeForumClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [aes, setAes] = useState<AE[]>([]);

  const [comment, setComment] = useState('');
  const [respBody, setRespBody] = useState('');
  const [respAeId, setRespAeId] = useState('');
  const [showAddResp, setShowAddResp] = useState(false);

  const loadFeed = useCallback(async () => {
    const r = await fetch('/api/ae-forum/posts');
    if (r.ok) {
      const d = await r.json();
      setPosts(d.posts ?? []);
      setActiveId((cur) => {
        if (cur) return cur;
        const wanted = searchParams.get('post');
        return wanted && (d.posts ?? []).some((p: FeedPost) => p.id === wanted) ? wanted : (d.posts?.[0]?.id ?? null);
      });
    }
  }, [searchParams]);

  useEffect(() => { loadFeed(); const t = setInterval(loadFeed, 8000); return () => clearInterval(t); }, [loadFeed]);
  useEffect(() => { fetch('/api/lender-aes').then((r) => (r.ok ? r.json() : { aes: [] })).then((d) => setAes(d.aes ?? [])).catch(() => {}); }, []);

  const loadThread = useCallback(async () => {
    if (!activeId) return;
    const r = await fetch(`/api/ae-forum/posts/${activeId}`);
    if (r.ok) setThread(await r.json());
  }, [activeId]);
  useEffect(() => {
    if (!activeId) { setThread(null); return; }
    setThread(null); loadThread();
    const t = setInterval(loadThread, 5000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  const filtered = useMemo(() => (filter === 'all' ? posts : posts.filter((p) => p.category === filter)), [posts, filter]);

  async function star(id: string) {
    await fetch('/api/ae-forum/star', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_id: id }) });
    loadThread();
  }
  async function markBest(id: string) {
    if (!activeId) return;
    await fetch(`/api/ae-forum/posts/${activeId}/best`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_id: id }) });
    loadThread();
  }
  async function sendComment() {
    if (!comment.trim() || !activeId) return;
    await fetch(`/api/ae-forum/posts/${activeId}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: comment.trim() }) });
    setComment(''); loadThread();
  }
  async function addResponse() {
    if (!respBody.trim() || !activeId) return;
    const ae = aes.find((a) => a.id === respAeId);
    await fetch(`/api/ae-forum/posts/${activeId}/response`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: respBody.trim(), lender_ae_id: respAeId || null, ae_name: ae?.ae_name ?? null }),
    });
    setRespBody(''); setRespAeId(''); setShowAddResp(false); loadThread();
  }

  const pendingCount = thread ? Math.max(0, thread.post.notified_ae_ids.length - thread.responses.length) : 0;

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[460px]">
      {/* Left: question list */}
      <div className="w-[300px] flex-shrink-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] flex flex-col">
        <div className="p-3 border-b border-[var(--c-border)] space-y-2">
          <Button onClick={() => setShowModal(true)} className="w-full"><Plus size={14} /> Post a question</Button>
          <div className="flex flex-wrap gap-1">
            {[{ key: 'all', label: 'All' }, ...FORUM_CATEGORIES].map((c) => (
              <button key={c.key} onClick={() => setFilter(c.key)} className={`text-[11px] px-2 py-0.5 rounded-full border ${filter === c.key ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <p className="text-[12px] text-[var(--c-label2)] text-center py-8">No questions yet.</p>}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => { setActiveId(p.id); router.replace(`/ae-connect/forum?post=${p.id}`); }}
              className={`w-full text-left px-3 py-2.5 border-b border-[var(--c-border)] transition-colors ${p.id === activeId ? 'bg-[var(--c-gold-light)]' : 'hover:bg-[var(--c-fill)]'}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <CategoryBadge category={p.category} />
                {p.unread && p.id !== activeId && <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-gold)]" />}
                {p.is_resolved && <Check size={11} className="text-[#3FB68B]" />}
              </div>
              <div className="text-[13px] font-medium text-[var(--c-text)] leading-snug line-clamp-2">{p.title}</div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--c-label2)]">
                <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {p.response_count}{p.response_count === 0 ? ' · waiting' : ''}</span>
                <span>{p.poster_name}</span>
                <span className="ml-auto">{timeAgo(p.last_activity)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: thread */}
      <div className="flex-1 min-w-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] flex flex-col">
        {!thread ? (
          <div className="flex-1 grid place-items-center text-[13px] text-[var(--c-label2)]">{activeId ? 'Loading…' : 'Select a question.'}</div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--c-border)]">
              <div className="flex items-center gap-1.5 mb-1"><CategoryBadge category={thread.post.category} />{thread.post.is_resolved && <span className="text-[10px] text-[#3FB68B] flex items-center gap-0.5"><Check size={10} /> Resolved</span>}</div>
              <h2 className="text-[16px] font-semibold text-[var(--c-text)]">{thread.post.title}</h2>
              {thread.post.body && <p className="text-[13px] text-[var(--c-label2)] mt-1 whitespace-pre-wrap">{thread.post.body}</p>}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--c-label2)] flex-wrap">
                <span>{thread.post.poster_name} · {timeAgo(thread.post.created_at)}</span>
                <span className="flex items-center gap-1"><Mail size={11} /> Sent to {thread.post.notified_ae_ids.length} AEs</span>
                <span className="flex items-center gap-1"><Users size={11} /> {thread.branch_member_count} teammates can see this</span>
              </div>
            </div>

            {/* Responses + comments */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {thread.responses.length === 0 && <p className="text-[12px] text-[var(--c-label2)] text-center py-4">No AE responses yet.</p>}
              {thread.responses.map((r) => {
                const name = r.lender_ae?.ae_name ?? r.ae_name ?? 'AE';
                const lender = r.lender_ae?.lender_name ?? '';
                const isBest = thread.post.best_response_id === r.id;
                return (
                  <div key={r.id} className={`rounded-[12px] border p-3 ${isBest ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)]' : 'border-[var(--c-border)]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[var(--c-gold)] grid place-items-center text-[9px] font-bold text-white">{name.slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-[var(--c-text)] truncate">{name}{r.lender_ae?.ae_title ? <span className="text-[var(--c-label3)] font-normal"> · {r.lender_ae.ae_title}</span> : ''}</div>
                          {lender && <div className="text-[10px] text-[var(--c-label2)]">{lender}{r.source === 'manual' ? ' · keyed in' : ''}</div>}
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--c-label3)] flex-shrink-0">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--c-text)] mt-2 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => star(r.id)} className={`flex items-center gap-1 text-[11px] ${r.user_starred ? 'text-[var(--c-gold-deep)]' : 'text-[var(--c-label2)] hover:text-[var(--c-text)]'}`}>
                        <Star size={12} className={r.user_starred ? 'fill-[var(--c-gold)] text-[var(--c-gold)]' : ''} /> {r.star_count}
                      </button>
                      {isBest ? (
                        <span className="text-[11px] text-[var(--c-gold-deep)] flex items-center gap-1"><Check size={11} /> Best answer</span>
                      ) : thread.is_author ? (
                        <button onClick={() => markBest(r.id)} className="text-[11px] text-[var(--c-label2)] hover:text-[var(--c-gold-deep)]">Mark as best</button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--c-label2)]"><Clock size={12} /> Waiting on {pendingCount} more AE{pendingCount > 1 ? 's' : ''}.</div>
              )}

              {/* Comments */}
              {thread.comments.map((c) => {
                const nm = c.author ? `${c.author.first_name ?? ''} ${c.author.last_name ?? ''}`.trim() || 'Teammate' : 'Teammate';
                return (
                  <div key={c.id} className="text-[12px] text-[var(--c-label2)] border-l-2 border-[var(--c-border)] pl-2.5">
                    <span className="font-medium text-[var(--c-text)]">{nm}</span> · {timeAgo(c.created_at)}
                    <p className="text-[var(--c-text)] whitespace-pre-wrap">{c.body}</p>
                  </div>
                );
              })}
            </div>

            {/* Footer: add AE response + comment */}
            <div className="border-t border-[var(--c-border)] p-3 space-y-2">
              {showAddResp ? (
                <div className="space-y-2 bg-[var(--c-fill)] rounded-[10px] p-2.5">
                  <div className="flex items-center justify-between"><span className="text-[12px] font-medium text-[var(--c-text)]">Add an AE response</span><button onClick={() => setShowAddResp(false)} className="text-[11px] text-[var(--c-label2)]">Cancel</button></div>
                  <select value={respAeId} onChange={(e) => setRespAeId(e.target.value)} className="w-full text-[12px] bg-[var(--c-surface)] rounded-[8px] px-2 py-1.5 focus:outline-none">
                    <option value="">— Which AE replied? —</option>
                    {aes.map((a) => <option key={a.id} value={a.id}>{a.ae_name} · {a.lender_name}</option>)}
                  </select>
                  <textarea value={respBody} onChange={(e) => setRespBody(e.target.value)} placeholder="Paste the AE's answer…" rows={2} className="w-full text-[13px] bg-[var(--c-surface)] rounded-[8px] px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
                  <Button onClick={addResponse} disabled={!respBody.trim()} className="w-full">Save response</Button>
                </div>
              ) : (
                <button onClick={() => setShowAddResp(true)} className="text-[11px] text-[var(--c-gold-deep)] hover:underline">+ Add AE response (from email/call)</button>
              )}
              <div className="flex items-end gap-2">
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }} placeholder="Add a follow-up for the team…" rows={1} className="flex-1 resize-none text-[13px] bg-[var(--c-fill)] rounded-[10px] px-3 py-2.5 max-h-[100px] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
                <Button onClick={sendComment} disabled={!comment.trim()}><Send size={14} /></Button>
              </div>
              <p className="text-[10px] text-[var(--c-label3)] flex items-center gap-1"><Eye size={10} /> Visible to {thread.branch_member_count} branch teammates · AEs reply via email</p>
            </div>
          </>
        )}
      </div>

      {showModal && <PostQuestionModal onClose={() => setShowModal(false)} onPosted={() => { setShowModal(false); loadFeed(); }} />}
    </div>
  );
}
