'use client';

import { CheckCircle, Circle, Clock, Phone, FileText, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  borrowerFirstName: string;
  currentStage: string;
  currentStageLabel: string;
  nextStep: string;
  pipelineSteps: Array<{ stage: string; label: string; status: 'completed' | 'current' | 'upcoming' }>;
  documents: Array<{ id: string; name: string; type: string; status: string }>;
  trid: { leSentDate: string | null; cdSentDate: string | null; closingDate: string | null } | null;
  lo: { name: string; phone: string | null; nmls: string | null; avatarUrl: string | null; title: string | null } | null;
  org: { name: string; logoUrl: string | null } | null;
}

export function BorrowerPortalClient({
  borrowerFirstName,
  currentStageLabel,
  nextStep,
  pipelineSteps,
  documents,
  trid,
  lo,
  org,
}: Props) {
  const pendingDocs = documents.filter((d) => d.status === 'requested');
  const uploadedDocs = documents.filter((d) => ['uploaded', 'verified'].includes(d.status));

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

        {/* Documents checklist */}
        {documents.length > 0 && (
          <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-label">Documents</h2>
              <span className="text-xs text-label-3">{uploadedDocs.length}/{documents.length} received</span>
            </div>
            <div className="space-y-2.5">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3">
                  {['uploaded', 'verified'].includes(doc.status) ? (
                    <CheckCircle size={16} className="text-green flex-shrink-0" />
                  ) : (
                    <Clock size={16} className="text-orange flex-shrink-0" />
                  )}
                  <span className={cn('text-sm flex-1', ['uploaded', 'verified'].includes(doc.status) ? 'text-label-2 line-through decoration-label-3' : 'text-label')}>
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
              ))}
            </div>
            {pendingDocs.length > 0 && (
              <p className="text-xs text-orange mt-3 flex items-center gap-1.5">
                <FileText size={12} />
                Please send your outstanding documents to help us keep your closing on track.
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
      </main>
    </div>
  );
}
