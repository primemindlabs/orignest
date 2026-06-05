'use client';

import { useState } from 'react';
import { Bot, Download, CheckCircle, AlertCircle, Clock, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

type ConfidenceLevel = 'High' | 'Medium' | 'Needs Review';

interface HmdaField {
  key: string;
  label: string;
  value: string;
  confidence: ConfidenceLevel | null;
  source: string;
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { color: string; icon: React.ElementType; bg: string }> = {
  High: { color: 'text-green', icon: CheckCircle, bg: 'bg-green/10' },
  Medium: { color: 'text-orange', icon: Clock, bg: 'bg-orange/10' },
  'Needs Review': { color: 'text-red', icon: AlertCircle, bg: 'bg-red/10' },
};

const EMPTY_FIELDS: HmdaField[] = [
  { key: 'action_taken', label: 'Action Taken', value: '', confidence: null, source: '' },
  { key: 'action_taken_date', label: 'Action Taken Date', value: '', confidence: null, source: '' },
  { key: 'ethnicity_1', label: 'Ethnicity', value: '', confidence: null, source: 'Self-reported' },
  { key: 'race_1', label: 'Race', value: '', confidence: null, source: 'Self-reported' },
  { key: 'sex', label: 'Sex', value: '', confidence: null, source: 'Self-reported' },
  { key: 'age_applicant', label: 'Age (Applicant)', value: '', confidence: null, source: '' },
  { key: 'income', label: 'Income (000s)', value: '', confidence: null, source: '' },
  { key: 'purchaser_type', label: 'Purchaser Type', value: '', confidence: null, source: '' },
  { key: 'rate_spread', label: 'Rate Spread', value: '', confidence: null, source: '' },
  { key: 'hoepa_status', label: 'HOEPA Status', value: '', confidence: null, source: '' },
  { key: 'lien_status', label: 'Lien Status', value: '', confidence: null, source: '' },
  { key: 'denial_reason_1', label: 'Denial Reason (if denied)', value: '', confidence: null, source: '' },
];

export default function HMDAPage() {
  const params = useParams();
  const leadId = params.id as string;
  const [fields, setFields] = useState<HmdaField[]>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPrefill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/hmda-prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      const data = await res.json() as { hmda: Record<string, unknown>; analysis: Record<string, { value: string | null; confidence: ConfidenceLevel; source: string }> };

      setFields((prev) =>
        prev.map((f) => {
          const analysisField = data.analysis[f.key];
          const hmdaVal = data.hmda[f.key];
          return {
            ...f,
            value: analysisField?.value ?? (hmdaVal != null ? String(hmdaVal) : ''),
            confidence: analysisField?.confidence ?? null,
            source: analysisField?.source ?? '',
          };
        }),
      );
      setPrefilled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prefill failed');
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value, confidence: f.confidence === 'High' ? 'Medium' : f.confidence } : f)));
  }

  function exportLAR() {
    const headers = fields.map((f) => f.label).join(',');
    const values = fields.map((f) => `"${f.value}"`).join(',');
    const csv = `${headers}\n${values}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmda_lar_${leadId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const missingFields = fields.filter((f) => !f.value && f.key !== 'denial_reason_1');
  const completionPct = Math.round(((fields.length - missingFields.length) / fields.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Back link */}
      <Link href={`/leads/${leadId}`} className="flex items-center gap-1.5 text-sm text-blue hover:text-blue/80">
        <ChevronLeft size={16} />
        Back to Lead
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-label tracking-tight">HMDA Pre-fill</h1>
          <p className="text-sm text-label-2 mt-0.5">AI-assisted Home Mortgage Disclosure Act data entry</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportLAR}
            disabled={!prefilled}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors',
              prefilled
                ? 'bg-black/[0.06] text-label hover:bg-black/[0.10]'
                : 'bg-black/[0.04] text-label-3 cursor-not-allowed',
            )}
          >
            <Download size={15} />
            Export LAR
          </button>
          <button
            onClick={runPrefill}
            disabled={loading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold transition-colors',
              loading ? 'bg-blue/60 text-white cursor-not-allowed' : 'bg-blue text-white hover:bg-blue/90',
            )}
          >
            <Bot size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Analyzing...' : 'AI Pre-fill'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red/10 border border-red/20 text-red text-sm px-4 py-3 rounded-[10px]">
          {error}
        </div>
      )}

      {/* Completion status */}
      <div className="bg-surface rounded-[10px] border border-black/[0.06] p-4 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-label">Completion</span>
          <span className={cn('text-sm font-bold', completionPct === 100 ? 'text-green' : 'text-orange')}>
            {completionPct}%
          </span>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', completionPct === 100 ? 'bg-green' : 'bg-blue')}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {missingFields.length > 0 && (
          <p className="text-xs text-label-3 mt-2">
            Missing: {missingFields.map((f) => f.label).join(', ')}
          </p>
        )}
      </div>

      {/* Fields */}
      <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card divide-y divide-black/[0.06]">
        {fields.map((field) => {
          const confConfig = field.confidence ? CONFIDENCE_CONFIG[field.confidence] : null;
          const ConfIcon = confConfig?.icon;

          return (
            <div key={field.key} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-label">{field.label}</label>
                {confConfig && ConfIcon && (
                  <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', confConfig.bg, confConfig.color)}>
                    <ConfIcon size={11} />
                    {field.confidence}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={field.value}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={['ethnicity_1', 'race_1', 'sex'].includes(field.key) ? 'Self-reported by borrower' : 'Enter value'}
                className={cn(
                  'w-full px-3 py-2 rounded-[8px] border text-sm focus:outline-none focus:ring-2 focus:ring-blue/20',
                  ['ethnicity_1', 'race_1', 'sex'].includes(field.key)
                    ? 'bg-black/[0.03] border-black/[0.06] text-label-3'
                    : 'bg-bg border-black/[0.12] focus:border-blue',
                )}
                readOnly={['ethnicity_1', 'race_1', 'sex'].includes(field.key)}
              />
              {field.source && (
                <p className="text-[11px] text-label-3 mt-1">Source: {field.source}</p>
              )}
              {['ethnicity_1', 'race_1', 'sex'].includes(field.key) && (
                <p className="text-[11px] text-orange mt-1 flex items-center gap-1">
                  <AlertCircle size={11} />
                  Demographic data must be self-reported by the applicant. Cannot be AI-prefilled.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-label-3 text-center pb-4">
        HMDA data is subject to CFPB regulations. Verify all fields before LAR submission.
        Demographic fields must be self-reported and cannot be inferred.
      </p>
    </div>
  );
}
