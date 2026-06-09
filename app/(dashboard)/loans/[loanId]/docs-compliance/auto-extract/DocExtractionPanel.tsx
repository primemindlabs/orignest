'use client';

/**
 * Phase 30.3 — Document Auto-Population review panel.
 * Lists extractions with confidence badges + discrepancy alerts; LO confirms
 * before any field is written to the 1003. Auto-extract is gated on AWS Textract.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sparkles, AlertTriangle, Check, FileScan } from 'lucide-react';

interface Discrepancy {
  field: string;
  label: string;
  extracted_value: unknown;
  existing_value: unknown;
  severity: 'info' | 'warning' | 'flag';
}
export interface ExtractionRow {
  id: string;
  document_type: string;
  extracted_fields: Record<string, unknown>;
  confidence: number;
  discrepancies: Discrepancy[];
  lo_confirmed: boolean;
  fields_applied: string[];
  created_at: string;
}

function confTone(c: number) {
  if (c >= 0.85) return { color: 'var(--c-gold-deep)', bg: 'var(--c-gold-light)', label: 'High' };
  if (c >= 0.6) return { color: '#9a6a00', bg: 'rgba(255,149,0,0.12)', label: 'Medium' };
  return { color: 'var(--c-danger)', bg: 'rgba(255,59,48,0.10)', label: 'Low' };
}

const TYPE_LABEL: Record<string, string> = { paystub: 'Pay Stub', w2: 'W-2', bank_statement: 'Bank Statement', '1099': '1099', tax_return: 'Tax Return', unknown: 'Document' };

export function DocExtractionPanel({ loanId, initial, textractConfigured }: { loanId: string; initial: ExtractionRow[]; textractConfigured: boolean }) {
  const [rows, setRows] = useState<ExtractionRow[]>(initial);
  const [applying, setApplying] = useState<string | null>(null);

  async function apply(id: string) {
    setApplying(id);
    try {
      const res = await fetch(`/api/loans/${loanId}/extractions/${id}/apply`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setRows((rs) => rs.map((r) => (r.id === id ? { ...r, lo_confirmed: true, fields_applied: data.applied ?? [] } : r)));
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="space-y-4">
      {!textractConfigured && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0">
            <FileScan size={16} className="text-[var(--c-label2)]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--c-text)]">Auto-population is ready — connect AWS Textract to turn it on</p>
            <p className="text-[12px] text-[var(--c-label2)] mt-1 leading-snug">
              Once AWS credentials + an S3 bucket are configured, uploading a pay stub, W-2, or bank statement extracts the data, scores confidence, flags any mismatch against the 1003, and pre-fills the application after you confirm. No document content is stored — only the structured fields.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 && textractConfigured && (
        <p className="text-[13px] text-[var(--c-label2)] py-6 text-center">No extractions yet. Upload a document to auto-extract its data.</p>
      )}

      {rows.map((row) => {
        const tone = confTone(row.confidence);
        const hasFlag = row.discrepancies.some((d) => d.severity === 'flag' || d.severity === 'warning');
        const fields = Object.entries(row.extracted_fields).filter(([, v]) => v != null && v !== '' && typeof v !== 'object');
        return (
          <div key={row.id} className="bg-[var(--c-surface)] border rounded-[14px] overflow-hidden" style={{ borderColor: hasFlag ? 'rgba(255,59,48,0.3)' : 'var(--c-border)' }}>
            <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--c-gold-deep)]" />
                <p className="text-[13px] font-semibold text-[var(--c-text)]">{TYPE_LABEL[row.document_type] ?? 'Document'}</p>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full" style={{ color: tone.color, background: tone.bg }}>
                {tone.label} · {Math.round(row.confidence * 100)}%
              </span>
            </div>

            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {fields.slice(0, 8).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] truncate">{k.replace(/_/g, ' ')}</p>
                  <p className="text-[12px] text-[var(--c-text)] truncate">{String(v)}</p>
                </div>
              ))}
            </div>

            {row.discrepancies.length > 0 && (
              <div className="px-4 pb-3 space-y-1.5">
                {row.discrepancies.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <AlertTriangle size={13} className={d.severity === 'flag' ? 'text-red mt-0.5' : 'text-orange mt-0.5'} />
                    <span className="text-[var(--c-text)]">
                      <strong>{d.label}:</strong> 1003 shows {String(d.existing_value)} · document shows {String(d.extracted_value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-[var(--c-border)] flex items-center gap-2">
              {row.lo_confirmed ? (
                <span className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)]">
                  <Check size={13} /> Applied{row.fields_applied.length ? ` · ${row.fields_applied.join(', ')}` : ''}
                </span>
              ) : (
                <Button onClick={() => apply(row.id)} disabled={applying === row.id}>
                  <Check size={13} /> {applying === row.id ? 'Applying…' : 'Review & Apply to 1003'}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
