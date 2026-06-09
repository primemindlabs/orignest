'use client';

/** Phase 58.3 — Content 360: per-contact engagement timeline + score + AI recs. */
import { useState, useEffect, useCallback } from 'react';
import { Mail, MessageSquare, Video, Image, TrendingDown, BarChart3, FileText, Sparkles } from 'lucide-react';

interface Ev { content_type: string; content_title: string | null; event_type: string; event_metadata: Record<string, unknown> | null; occurred_at: string }
interface Score { score: number; tier: string; trend: string }
interface Stats { emails_sent: number; open_rate: number; total_engagements: number; last_contact_at: string | null }
interface Rec { type: string; title: string; reason: string; priority: number }

const ICON: Record<string, typeof Mail> = { email_campaign: Mail, email_manual: Mail, sms: MessageSquare, video_message: Video, co_marketing_flyer: Image, market_update: BarChart3, rate_drop_alert: TrendingDown };
const EVENT_COLOR: Record<string, string> = { sent: 'var(--c-label2)', delivered: 'var(--c-label2)', opened: 'var(--c-gold-deep)', clicked: '#27AE60', replied: '#0E9F9F', watched: '#27AE60', downloaded: '#27AE60', shared: '#6450B4', bounced: 'var(--c-danger)', unsubscribed: 'var(--c-danger)' };
const TIER_COLOR: Record<string, string> = { hot: '#27AE60', warm: 'var(--c-gold-deep)', cold: '#F39C12', unengaged: 'var(--c-label2)' };
const rel = (d: string) => { const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000); return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`; };

export function Content360Client({ contactId, contactType }: { contactId: string; contactType: 'lead' | 'realtor' | 'partner' }) {
  const [timeline, setTimeline] = useState<Ev[]>([]);
  const [score, setScore] = useState<Score | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/content-360?contact_id=${contactId}&contact_type=${contactType}`);
    if (r.ok) { const d = await r.json(); setTimeline(d.timeline ?? []); setScore(d.score); setStats(d.stats); setRecs(d.recommendations); }
  }, [contactId, contactType]);
  useEffect(() => { load(); }, [load]);

  async function genRecs() {
    setBusy(true);
    try { const r = await fetch('/api/content-360', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId, contact_type: contactType }) }); if (r.ok) setRecs((await r.json()).recommendations ?? []); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            {[['Emails sent', String(stats.emails_sent)], ['Open rate', `${stats.open_rate}%`], ['Engagements', String(stats.total_engagements)], ['Last contact', stats.last_contact_at ? rel(stats.last_contact_at) : '—']].map(([l, v]) => (
              <div key={l} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">{l}</p><p className="text-[15px] font-semibold text-[var(--c-text)] mt-0.5">{v}</p></div>
            ))}
          </div>
        )}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Engagement timeline</p>
          {timeline.length === 0 ? <p className="text-[13px] text-[var(--c-label2)]">No content touchpoints yet. Sends from campaigns, SMS, video, and flyers will appear here.</p> : (
            <div className="space-y-1.5">
              {timeline.map((e, i) => {
                const Icon = ICON[e.content_type] ?? FileText;
                return (
                  <div key={i} className="flex items-start gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] px-3 py-2">
                    <Icon size={15} className="text-[var(--c-label2)] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--c-text)]">{e.content_title || e.content_type.replace(/_/g, ' ')}</p>
                      <div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full" style={{ color: EVENT_COLOR[e.event_type], backgroundColor: 'var(--c-fill)' }}>{e.event_type}</span><span className="text-[11px] text-[var(--c-label3)]">{rel(e.occurred_at)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {score && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 text-center">
            <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] mb-2">Engagement score</p>
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ border: `4px solid ${TIER_COLOR[score.tier]}` }}><span className="text-[26px] font-bold text-[var(--c-text)]">{score.score}</span></div>
            <p className="text-[13px] font-semibold mt-2 capitalize" style={{ color: TIER_COLOR[score.tier] }}>{score.tier}</p>
            <p className="text-[11px] text-[var(--c-label2)]">trend {score.trend === 'up' ? '↑' : score.trend === 'down' ? '↓' : '→'}</p>
          </div>
        )}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <div className="flex items-center justify-between mb-2"><p className="text-[12px] font-semibold text-[var(--c-text)]">Next best content</p><button onClick={genRecs} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-[var(--c-gold-deep)] hover:underline"><Sparkles size={12} /> {busy ? '…' : 'Generate'}</button></div>
          {!recs ? <p className="text-[12px] text-[var(--c-label2)]">Generate AI recommendations based on engagement history.</p> : recs.length === 0 ? <p className="text-[12px] text-[var(--c-label2)]">No recommendations.</p> : (
            <div className="space-y-2">{recs.sort((a, b) => a.priority - b.priority).map((r, i) => (
              <div key={i} className="bg-[var(--c-bg)] rounded-[8px] p-2.5"><p className="text-[12px] font-medium text-[var(--c-text)]">{r.title}</p><p className="text-[11px] text-[var(--c-label2)] mt-0.5">{r.reason}</p></div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
