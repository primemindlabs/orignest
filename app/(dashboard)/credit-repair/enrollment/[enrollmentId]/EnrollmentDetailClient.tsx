'use client';

import Link from 'next/link';
import { ArrowLeft, Phone, Mail } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ScorePoint { date: string; exp?: number; eqx?: number; tu?: number; avg?: number }
interface Dispute {
  id: string; bureau: string; letter_type: string; cycle_number: number;
  response_status: string; sent_at: string | null; expected_response_by: string | null;
  lob_status: string | null; ai_next_action: string | null;
}
interface Tradeline { id: string; creditor_name: string; bureau: string; dispute_status: string; estimated_score_gain: number | null }
interface Enrollment {
  id: string; status: string; subscription_status: string; target_score: number;
  starting_score_exp: number | null; current_score_exp: number | null;
  current_score_eqx: number | null; current_score_tu: number | null;
  mortgage_ready_at: string | null; score_history: unknown;
  leads: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}

const RESP_COLORS: Record<string, string> = {
  pending: 'bg-black/[0.06] text-label-2',
  awaiting_response: 'bg-orange/10 text-orange',
  item_removed: 'bg-green/10 text-green',
  item_updated: 'bg-blue/10 text-blue',
  verified_accurate: 'bg-red/10 text-red',
  no_response: 'bg-black/[0.06] text-label-2',
};

export function EnrollmentDetailClient({ enrollment, disputes, tradelines }: { enrollment: Enrollment; disputes: Dispute[]; tradelines: Tradeline[] }) {
  const name = enrollment.leads ? `${enrollment.leads.first_name} ${enrollment.leads.last_name}` : 'Borrower';
  const history = (Array.isArray(enrollment.score_history) ? enrollment.score_history : []) as ScorePoint[];
  const chartData = history.map((h) => ({ date: h.date, Experian: h.exp, Equifax: h.eqx, TransUnion: h.tu }));

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/credit-repair" className="inline-flex items-center gap-1.5 text-sm text-label-2 hover:text-label">
        <ArrowLeft size={15} /> Back to Credit Repair
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-label">{name}</h1>
          <p className="text-sm text-label-2 capitalize">{enrollment.status.replace(/_/g, ' ')} · target {enrollment.target_score} · billing {enrollment.subscription_status}</p>
        </div>
        <div className="flex gap-2">
          {enrollment.leads?.phone && <a href={`tel:${enrollment.leads.phone}`} className="flex items-center gap-1.5 px-3 py-2 bg-blue text-white text-sm font-semibold rounded-xl hover:bg-blue/90"><Phone size={14} /> Call</a>}
          {enrollment.leads?.email && <a href={`mailto:${enrollment.leads.email}`} className="flex items-center gap-1.5 px-3 py-2 border border-black/[0.10] text-label-2 text-sm rounded-xl hover:bg-bg"><Mail size={14} /> Email</a>}
        </div>
      </div>

      {/* Score chart */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
        <h2 className="text-sm font-semibold text-label mb-3">Score History</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-label-3 py-8 text-center">No score history yet.</p>
        ) : (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[500, 800]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Experian" stroke="#007AFF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Equifax" stroke="#34C759" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="TransUnion" stroke="#C9A95C" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Dispute timeline */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
        <h2 className="text-sm font-semibold text-label mb-3">Dispute Timeline</h2>
        {disputes.length === 0 ? (
          <p className="text-sm text-label-3">No disputes filed yet.</p>
        ) : (
          <div className="space-y-2">
            {disputes.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-black/[0.06]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-label capitalize">{d.bureau} · {d.letter_type.replace(/_/g, ' ')} <span className="text-label-3">(cycle {d.cycle_number})</span></p>
                  <p className="text-[11px] text-label-3">{d.sent_at ? `Sent ${new Date(d.sent_at).toLocaleDateString()}` : 'Not sent'}{d.lob_status ? ` · ${d.lob_status}` : ''}</p>
                  {d.ai_next_action && <p className="text-xs text-label-2 mt-0.5">{d.ai_next_action}</p>}
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize whitespace-nowrap ${RESP_COLORS[d.response_status] ?? 'bg-black/[0.06] text-label-2'}`}>{d.response_status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tradelines */}
      {tradelines.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5">
          <h2 className="text-sm font-semibold text-label mb-3">Identified Items</h2>
          <div className="space-y-1.5">
            {tradelines.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-label">{t.creditor_name} <span className="text-label-3">· {t.bureau}</span></span>
                <span className="flex items-center gap-2">
                  {t.estimated_score_gain != null && <span className="text-[10px] text-green">+{t.estimated_score_gain}</span>}
                  <span className="text-xs text-label-2 capitalize">{t.dispute_status.replace(/_/g, ' ')}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
