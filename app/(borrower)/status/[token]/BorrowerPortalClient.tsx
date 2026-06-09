'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, Phone, FileText, ShieldCheck, UploadCloud, LayoutDashboard } from 'lucide-react';
import { PortalMessages } from '@/components/borrower/PortalMessages';
import { BorrowerJourneyWidgets } from '@/components/borrower/BorrowerJourneyWidgets';
import { cn } from '@/lib/utils';
import { CreditRepairTab, type CreditRepairEnrollment } from './CreditRepairTab';

interface DocItem {
  id: string;
  name: string;
  type: string;
  status: string;
  fileName?: string | null;
  uploading?: boolean;
  progress?: number;
  error?: string | null;
}

interface Props {
  token: string;
  borrowerFirstName: string;
  currentStage: string;
  currentStageLabel: string;
  nextStep: string;
  pipelineSteps: Array<{ stage: string; label: string; status: 'completed' | 'current' | 'upcoming' }>;
  documents: Array<{ id: string; name: string; type: string; status: string }>;
  trid: { leSentDate: string | null; cdSentDate: string | null; closingDate: string | null } | null;
  lo: { name: string; phone: string | null; nmls: string | null; avatarUrl: string | null; title: string | null } | null;
  org: { name: string; logoUrl: string | null } | null;
  creditRepair: CreditRepairEnrollment | null;
}

const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BorrowerPortalClient({
  token,
  borrowerFirstName,
  currentStage,
  currentStageLabel,
  nextStep,
  pipelineSteps,
  documents,
  trid,
  lo,
  org,
  creditRepair,
}: Props) {
  const [docs, setDocs] = useState<DocItem[]>(documents);
  const [activeTab, setActiveTab] = useState<'status' | 'credit-repair'>('status');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'credit-repair') setActiveTab('credit-repair');
  }, []);
  const pendingDocs = docs.filter((d) => d.status === 'requested');
  const uploadedDocs = docs.filter((d) => ['uploaded', 'verified'].includes(d.status));

  function patchDoc(id: string, patch: Partial<DocItem>) {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function handleUpload(doc: DocItem, file: File) {
    if (!ACCEPTED_MIME.includes(file.type)) {
      patchDoc(doc.id, { error: 'Only PDF, JPG, PNG, or WEBP files are accepted.' });
      return;
    }
    if (file.size > MAX_BYTES) {
      patchDoc(doc.id, { error: 'File must be under 25MB.' });
      return;
    }

    patchDoc(doc.id, { uploading: true, progress: 0, error: null, fileName: file.name });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', doc.type);
    formData.append('document_id', doc.id);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/borrower-portal/${token}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        patchDoc(doc.id, { progress: Math.round((e.loaded / e.total) * 100) });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        patchDoc(doc.id, { status: 'uploaded', uploading: false, progress: 100, fileName: file.name });
      } else {
        let message = 'Upload failed. Please try again.';
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          /* keep default message */
        }
        patchDoc(doc.id, { uploading: false, progress: 0, error: message });
      }
    };

    xhr.onerror = () => {
      patchDoc(doc.id, { uploading: false, progress: 0, error: 'Network error. Please try again.' });
    };

    xhr.send(formData);
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <header className="bg-[rgba(255,255,255,0.92)] backdrop-blur-[20px] border-b border-[rgba(60,60,67,0.12)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-7 object-contain" />
            ) : (
              <div className="w-7 h-7 rounded-[7px] bg-navy flex items-center justify-center">
                <span className="text-gold text-[10px] font-bold">C</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-label">{org?.name ?? 'Your Mortgage'}</p>
              <p className="text-xs text-label-3">Loan Status Portal</p>
            </div>
          </div>
          {lo?.phone && (
            <a
              href={`tel:${lo.phone}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-full hover:bg-navy/90 transition-colors"
            >
              <Phone size={13} />
              Call LO
            </a>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-black/[0.05] rounded-xl">
          <button
            onClick={() => setActiveTab('status')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-all',
              activeTab === 'status' ? 'bg-white text-label shadow-sm' : 'text-label-2'
            )}
          >
            <LayoutDashboard size={14} /> Loan Status
          </button>
          <button
            onClick={() => setActiveTab('credit-repair')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-all',
              activeTab === 'credit-repair' ? 'bg-white text-label shadow-sm' : 'text-label-2'
            )}
          >
            <ShieldCheck size={14} /> Credit Repair
          </button>
        </div>

        {activeTab === 'credit-repair' ? (
          <CreditRepairTab token={token} initial={creditRepair} borrowerFirstName={borrowerFirstName} />
        ) : (
        <>
        {/* Welcome */}
        <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
          <p className="text-xs text-label-3 mb-1">Welcome back</p>
          <h1 className="text-2xl font-bold text-label tracking-tight">{borrowerFirstName}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-blue">{currentStageLabel}</span>
          </div>
        </div>

        {/* Pipeline progress */}
        <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
          <h2 className="text-sm font-semibold text-label mb-4">Loan Progress</h2>
          <div className="space-y-3">
            {pipelineSteps.map((step, idx) => (
              <div key={step.stage} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {step.status === 'completed' ? (
                    <CheckCircle size={18} className="text-green" />
                  ) : step.status === 'current' ? (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-blue bg-blue/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue" />
                    </div>
                  ) : (
                    <Circle size={18} className="text-label-3" />
                  )}
                </div>
                {/* Connector line */}
                <div className="flex-shrink-0 absolute" />
                <span className={cn(
                  'text-sm',
                  step.status === 'completed' ? 'text-label-2 line-through decoration-label-3' :
                  step.status === 'current' ? 'text-label font-semibold' : 'text-label-3',
                )}>
                  {step.label}
                </span>
                {step.status === 'current' && (
                  <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue/10 text-blue">Current</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Next step */}
        <div className="bg-blue/10 border border-blue/20 rounded-[10px] p-4">
          <p className="text-xs font-semibold text-blue mb-1">What happens next</p>
          <p className="text-sm text-blue/90 leading-relaxed">{nextStep}</p>
        </div>

        {/* Buyer-experience widgets (Phase 19): countdown, first payment, moving, cert */}
        <BorrowerJourneyWidgets
          token={token}
          currentStage={currentStage}
          closingDate={trid?.closingDate ?? null}
        />

        {/* Two-way messaging with the loan officer (Phase 4.2) */}
        <PortalMessages token={token} loName={lo?.name ?? 'your loan officer'} />

        {/* Documents checklist */}
        {docs.length > 0 && (
          <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-label">Documents</h2>
              <span className="text-xs text-label-3">{uploadedDocs.length}/{docs.length} received</span>
            </div>
            <div className="space-y-3">
              {docs.map((doc) => {
                const isDone = ['uploaded', 'verified'].includes(doc.status);
                return (
                  <div key={doc.id} className="flex flex-col gap-2 border-b border-black/[0.04] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle size={16} className="text-green flex-shrink-0" />
                      ) : (
                        <Clock size={16} className="text-orange flex-shrink-0" />
                      )}
                      <span className={cn('text-sm flex-1', isDone ? 'text-label-2 line-through decoration-label-3' : 'text-label')}>
                        {doc.name}
                      </span>
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        doc.status === 'verified' ? 'bg-green/10 text-green' :
                        doc.status === 'uploaded' ? 'bg-blue/10 text-blue' :
                        'bg-orange/10 text-orange',
                      )}>
                        {doc.status === 'requested' ? 'Needed' : doc.status === 'uploaded' ? 'Received' : 'Verified'}
                      </span>
                    </div>

                    {/* Uploaded / verified file name */}
                    {isDone && doc.fileName && (
                      <p className="text-xs text-green flex items-center gap-1.5 pl-7">
                        <CheckCircle size={11} />
                        {doc.fileName}
                        <span className="text-label-3">· Uploaded just now</span>
                      </p>
                    )}

                    {/* Upload control for requested docs */}
                    {doc.status === 'requested' && (
                      <div className="pl-7">
                        {doc.uploading ? (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-label-2 truncate max-w-[70%]">{doc.fileName}</span>
                              <span className="text-xs text-label-3">{doc.progress ?? 0}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
                              <div
                                className="h-full bg-blue transition-all duration-150"
                                style={{ width: `${doc.progress ?? 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue/10 text-blue text-xs font-semibold rounded-[8px] cursor-pointer hover:bg-blue/15 transition-colors">
                            <UploadCloud size={13} />
                            Upload File
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(doc, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                        {doc.error && (
                          <p className="text-xs text-red mt-1.5">{doc.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {pendingDocs.length > 0 && (
              <p className="text-xs text-orange mt-3 flex items-center gap-1.5">
                <FileText size={12} />
                Upload your outstanding documents above to help us keep your closing on track.
              </p>
            )}
          </div>
        )}

        {/* TRID dates */}
        {trid && (
          <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-navy" />
              <h2 className="text-sm font-semibold text-label">Disclosure Timeline</h2>
            </div>
            <div className="space-y-2">
              {trid.leSentDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-label-2">Loan Estimate sent</span>
                  <span className="font-medium text-label">{new Date(trid.leSentDate).toLocaleDateString()}</span>
                </div>
              )}
              {trid.cdSentDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-label-2">Closing Disclosure sent</span>
                  <span className="font-medium text-label">{new Date(trid.cdSentDate).toLocaleDateString()}</span>
                </div>
              )}
              {trid.closingDate && (
                <div className="flex justify-between text-sm border-t border-black/[0.06] pt-2 mt-2">
                  <span className="text-label-2">Expected closing</span>
                  <span className="font-semibold text-navy">{new Date(trid.closingDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LO contact */}
        {lo && (
          <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
            <h2 className="text-sm font-semibold text-label mb-3">Your Loan Officer</h2>
            <div className="flex items-center gap-3">
              {lo.avatarUrl ? (
                <img src={lo.avatarUrl} alt={lo.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-navy flex items-center justify-center text-white font-bold text-sm">
                  {lo.name.split(' ').map((n) => n[0]).join('')}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-label">{lo.name}</p>
                {lo.title && <p className="text-xs text-label-3">{lo.title}</p>}
                {lo.nmls && <p className="text-xs text-label-3">NMLS #{lo.nmls}</p>}
              </div>
              {lo.phone && (
                <a
                  href={`tel:${lo.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-navy text-white text-xs font-semibold rounded-[10px] hover:bg-navy/90 transition-colors"
                >
                  <Phone size={13} />
                  Call
                </a>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-label-3 text-center pb-4">
          This portal is provided for informational purposes only. Contact your loan officer for any questions.
        </p>
        </>
        )}
      </main>
    </div>
  );
}
