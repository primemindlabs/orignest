// Phase 89b — build the enriched forum feed for an org (used by the list + unread badge).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FeedPost {
  id: string;
  posted_by: string;
  category: string;
  title: string;
  body: string | null;
  notified_ae_ids: string[];
  is_resolved: boolean;
  best_response_id: string | null;
  created_at: string;
  response_count: number;
  last_activity: string;
  unread: boolean;
  responder_names: string[];
  poster_name: string;
}

export async function buildForumFeed(sb: SupabaseClient<any, any, any>, orgId: string, me: string): Promise<FeedPost[]> {
  const { data: posts } = await sb
    .from('ae_forum_posts')
    .select('id, posted_by, category, title, body, notified_ae_ids, is_resolved, best_response_id, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id as string);
  const [{ data: responses }, { data: reads }, { data: posters }] = await Promise.all([
    sb.from('ae_forum_responses').select('post_id, created_at, lender_ae_id, ae_name').in('post_id', postIds),
    sb.from('ae_forum_reads').select('post_id, last_read_at').eq('user_id', me).in('post_id', postIds),
    sb.from('profiles').select('id, first_name, last_name').in('id', Array.from(new Set(posts.map((p) => p.posted_by as string)))),
  ]);

  const aeIds = Array.from(new Set((responses ?? []).map((r) => r.lender_ae_id as string | null).filter((x): x is string => !!x)));
  const aeNameById: Record<string, string> = {};
  if (aeIds.length > 0) {
    const { data: aes } = await sb.from('lender_ae_connections').select('id, ae_name').in('id', aeIds);
    for (const a of aes ?? []) aeNameById[a.id as string] = a.ae_name as string;
  }

  const posterById: Record<string, { first_name: string | null; last_name: string | null }> = {};
  for (const p of posters ?? []) posterById[p.id as string] = p;
  const readBy: Record<string, string> = {};
  for (const r of reads ?? []) readBy[r.post_id as string] = r.last_read_at as string;
  const respByPost: Record<string, { created_at: string; lender_ae_id: string | null; ae_name: string | null }[]> = {};
  for (const r of responses ?? []) (respByPost[r.post_id as string] ??= []).push(r as never);

  return posts.map((p) => {
    const rs = respByPost[p.id as string] ?? [];
    const lastActivity = rs.reduce((mx, r) => (r.created_at > mx ? r.created_at : mx), p.created_at as string);
    const read = readBy[p.id as string];
    const unread = !read || lastActivity > read;
    const responderNames = Array.from(
      new Set(rs.map((r) => r.ae_name ?? (r.lender_ae_id ? aeNameById[r.lender_ae_id] : null)).filter((x): x is string => !!x)),
    ).slice(0, 3);
    const poster = posterById[p.posted_by as string];
    return {
      ...(p as Omit<FeedPost, 'response_count' | 'last_activity' | 'unread' | 'responder_names' | 'poster_name'>),
      response_count: rs.length,
      last_activity: lastActivity,
      unread,
      responder_names: responderNames,
      poster_name: poster ? `${poster.first_name ?? ''} ${poster.last_name ?? ''}`.trim() || 'Teammate' : 'Teammate',
    };
  });
}
