'use client';

import { useState } from 'react';
import { Bot, RefreshCw, CheckCircle, AlertTriangle, TrendingUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealAnalysis {
  approvalLikelihood: 'High' | 'Medium' | 'Low';
  approvalConfidence: number;
  topIssues: string[];
  recommendedProduct: string;
  productRationale: string;
  talkingPoints: string[];
  redFlags: string[];
  summary: string;
}

interface Props {
  leadId: string;
}

const LIKELIHOOD_COLORS: Record<string, string> = {
  High: 'text-green',
  Medium: 'text-orange',
  Low: 'text-red',
};

const LIKELIHOOD_BG: Record<string, string> = {
  High: 'bg-green',
  Medium: 'bg-orange',
  Low: 'bg-red',
};

export function DealAnalysisPanel({ leadId }: Props) {
  const [analysis, setAnalysis] = useState<DealAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/deal-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const data = await res.json() as { analysis: DealAnalysis };
      setAnalysis(data.analysis);
      setLastRun(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-navy/10 flex items-center justify-center">
            <Bot size={14} className="text-navy" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-label">AI Deal Analysis</h3>
            {lastRun && <p className="text-[11px] text-label-3">Last run: {lastRun.toLocaleTimeString()}</p>}
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors',
            loading ? 'bg-navy/60 text-white cursor-not-allowed' : 'bg-navy text-white hover:bg-navy/90',
          )}
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Bot size={12} />}
          {loading ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-4 bg-red/10 border border-red/20 text-red text-xs px-3 py-2.5 rounded-[8px]">
          {error}
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="px-5 py-8 text-center">
          <Bot size={28} className="mx-auto text-label-3 mb-2" />
          <p className="text-sm text-label-2">Click &quot;Run Analysis&quot; to get AI-powered underwriting insights</p>
          <p className="text-xs text-label-3 mt-1">Powered by Claude Haiku</p>
        </div>
      )}

      {analysis && (
        <div className="px-5 py-4 space-y-4">
          {/* Approval gauge */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={analysis.approvalLikelihood === 'High' ? '#34C759' : analysis.approvalLikelihood === 'Medium' ? '#FF9500' : '#FF3B30'}
                  strokeWidth="3"
                  strokeDasharray={`${analysis.approvalConfidence}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-label">{analysis.approvalConfidence}%</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-label-3 mb-0.5">Approval Likelihood</p>
              <p className={cn('text-xl font-bold', LIKELIHOOD_COLORS[analysis.approvalLikelihood])}>
                {analysis.approvalLikelihood}
              </p>
              <p className="text-xs text-label-2 mt-0.5">{analysis.summary}</p>
            </div>
          </div>

          {/* Recommended product */}
          <div className="bg-blue/10 rounded-[8px] px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp size={12} className="text-blue" />
              <p className="text-xs font-semibold text-blue">Recommended: {analysis.recommendedProduct.toUpperCase()}</p>
            </div>
            <p className="text-xs text-blue/80">{analysis.productRationale}</p>
          </div>

          {/* Top issues */}
          {analysis.topIssues?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-label-2 mb-2">Top Issues</p>
              <div className="space-y-1.5">
                {analysis.topIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-label-2">
                    <AlertTriangle size={12} className="text-orange flex-shrink-0 mt-0.5" />
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Red flags */}
          {analysis.redFlags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-label-2 mb-2">Red Flags</p>
              <div className="space-y-1.5">
                {analysis.redFlags.map((flag, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-red">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    {flag}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Talking points */}
          {analysis.talkingPoints?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare size={12} className="text-label-3" />
                <p className="text-xs font-semibold text-label-2">Borrower Talking Points</p>
              </div>
              <div className="space-y-1.5">
                {analysis.talkingPoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-label-2">
                    <CheckCircle size={12} className="text-green flex-shrink-0 mt-0.5" />
                    {point}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
