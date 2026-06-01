'use client';

import { clsx } from 'clsx';
import { CheckCircle2, AlertCircle, Clock, XCircle, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { TRIDStatus, TRIDStatusValue } from '@/types';

interface TRIDTimelineProps {
  tridStatus: TRIDStatus;
  applicationDate: string | null;
  leDeadline: string | null;
  leSentAt: string | null;
  closingDate: string | null;
  cdDeadline: string | null;
  cdSentAt: string | null;
  onMarkLESent?: () => void;
  onMarkCDSent?: () => void;
  canEdit?: boolean;
}

function StatusIcon({ status }: { status: TRIDStatusValue }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="text-green" size={18} />;
    case 'due_today':
      return <Clock className="text-orange" size={18} />;
    case 'overdue':
      return <XCircle className="text-red" size={18} />;
    case 'blocked':
      return <AlertCircle className="text-red" size={18} />;
    case 'not_applicable':
      return <MinusCircle className="text-label-3" size={18} />;
  }
}

function statusLabel(status: TRIDStatusValue): string {
  switch (status) {
    case 'ok': return 'On Track';
    case 'due_today': return 'Due Today';
    case 'overdue': return 'Overdue';
    case 'blocked': return 'Blocked';
    case 'not_applicable': return 'Not Applicable';
  }
}

function statusClass(status: TRIDStatusValue): string {
  switch (status) {
    case 'ok': return 'border-green/20 bg-green/5';
    case 'due_today': return 'border-orange/20 bg-orange/5';
    case 'overdue': return 'border-red/20 bg-red/5';
    case 'blocked': return 'border-red/20 bg-red/5';
    case 'not_applicable': return 'border-[rgba(60,60,67,0.12)] bg-bg';
  }
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

export function TRIDTimeline({
  tridStatus,
  applicationDate,
  leDeadline,
  leSentAt,
  closingDate,
  cdDeadline,
  cdSentAt,
  onMarkLESent,
  onMarkCDSent,
  canEdit = false,
}: TRIDTimelineProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-black mb-1">TRID Compliance Timeline</h3>
        <p className="text-[12px] text-label-2">
          TILA-RESPA Integrated Disclosure requirements (12 CFR 1026.19)
        </p>
      </div>

      {/* Loan Estimate Section */}
      <div
        className={clsx(
          'rounded-card border p-4 space-y-3',
          statusClass(tridStatus.le)
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <StatusIcon status={tridStatus.le} />
            <div>
              <p className="text-[14px] font-semibold text-black">Loan Estimate (LE)</p>
              <p className="text-[12px] text-label-2">
                Must be delivered within 3 business days of application receipt
              </p>
            </div>
          </div>
          <span
            className={clsx(
              'text-[12px] font-semibold px-2 py-0.5 rounded-full',
              tridStatus.le === 'ok' && 'text-green bg-green/10',
              tridStatus.le === 'due_today' && 'text-orange bg-orange/10',
              (tridStatus.le === 'overdue' || tridStatus.le === 'blocked') && 'text-red bg-red/10',
              tridStatus.le === 'not_applicable' && 'text-label-2 bg-[rgba(60,60,67,0.06)]'
            )}
          >
            {statusLabel(tridStatus.le)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="text-label-2 mb-0.5">Application Date</p>
            <p className="font-medium text-black">{fmtDate(applicationDate)}</p>
          </div>
          <div>
            <p className="text-label-2 mb-0.5">LE Deadline</p>
            <p
              className={clsx(
                'font-medium',
                (tridStatus.le === 'overdue' || tridStatus.le === 'due_today')
                  ? 'text-red'
                  : 'text-black'
              )}
            >
              {fmtDate(leDeadline)}
            </p>
          </div>
          <div>
            <p className="text-label-2 mb-0.5">LE Sent</p>
            <p className={clsx('font-medium', leSentAt ? 'text-green' : 'text-label-3')}>
              {leSentAt ? fmtDate(leSentAt) : 'Not yet sent'}
            </p>
          </div>
          {tridStatus.le_days_remaining !== null && (
            <div>
              <p className="text-label-2 mb-0.5">Days Remaining</p>
              <p
                className={clsx(
                  'font-medium',
                  tridStatus.le_days_remaining <= 0 ? 'text-red' : 'text-black'
                )}
              >
                {tridStatus.le_days_remaining <= 0
                  ? `${Math.abs(tridStatus.le_days_remaining)} day${Math.abs(tridStatus.le_days_remaining) !== 1 ? 's' : ''} overdue`
                  : `${tridStatus.le_days_remaining} day${tridStatus.le_days_remaining !== 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {canEdit && !leSentAt && tridStatus.le !== 'not_applicable' && onMarkLESent && (
          <button
            onClick={onMarkLESent}
            className="w-full h-8 rounded-[8px] bg-blue text-white text-[13px] font-medium hover:bg-blue/90 transition-colors"
          >
            Mark LE as Sent
          </button>
        )}
      </div>

      {/* Closing Disclosure Section */}
      <div
        className={clsx(
          'rounded-card border p-4 space-y-3',
          statusClass(tridStatus.cd)
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <StatusIcon status={tridStatus.cd} />
            <div>
              <p className="text-[14px] font-semibold text-black">Closing Disclosure (CD)</p>
              <p className="text-[12px] text-label-2">
                Must be received 3 business days before consummation
              </p>
            </div>
          </div>
          <span
            className={clsx(
              'text-[12px] font-semibold px-2 py-0.5 rounded-full',
              tridStatus.cd === 'ok' && 'text-green bg-green/10',
              tridStatus.cd === 'due_today' && 'text-orange bg-orange/10',
              (tridStatus.cd === 'overdue' || tridStatus.cd === 'blocked') && 'text-red bg-red/10',
              tridStatus.cd === 'not_applicable' && 'text-label-2 bg-[rgba(60,60,67,0.06)]'
            )}
          >
            {statusLabel(tridStatus.cd)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="text-label-2 mb-0.5">Closing Date</p>
            <p className="font-medium text-black">{fmtDate(closingDate)}</p>
          </div>
          <div>
            <p className="text-label-2 mb-0.5">Last CD Send Date</p>
            <p
              className={clsx(
                'font-medium',
                (tridStatus.cd === 'overdue' || tridStatus.cd === 'blocked')
                  ? 'text-red'
                  : 'text-black'
              )}
            >
              {fmtDate(cdDeadline)}
            </p>
          </div>
          <div>
            <p className="text-label-2 mb-0.5">CD Sent</p>
            <p className={clsx('font-medium', cdSentAt ? 'text-green' : 'text-label-3')}>
              {cdSentAt ? fmtDate(cdSentAt) : 'Not yet sent'}
            </p>
          </div>
          {tridStatus.cd_days_remaining !== null && (
            <div>
              <p className="text-label-2 mb-0.5">Days Remaining</p>
              <p
                className={clsx(
                  'font-medium',
                  tridStatus.cd_days_remaining <= 0 ? 'text-red' : 'text-black'
                )}
              >
                {tridStatus.cd_days_remaining <= 0
                  ? `${Math.abs(tridStatus.cd_days_remaining)} day${Math.abs(tridStatus.cd_days_remaining) !== 1 ? 's' : ''} overdue`
                  : `${tridStatus.cd_days_remaining} day${tridStatus.cd_days_remaining !== 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {tridStatus.cd === 'blocked' && !closingDate && (
          <div className="flex items-start gap-2 p-3 rounded-[8px] bg-red/8 border border-red/20">
            <AlertCircle size={14} className="text-red flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red font-medium">
              Set a closing date to calculate the CD deadline. A loan cannot advance to Clear to
              Close without a valid CD delivery record.
            </p>
          </div>
        )}

        {tridStatus.cd === 'blocked' && closingDate && !cdSentAt && (
          <div className="flex items-start gap-2 p-3 rounded-[8px] bg-red/8 border border-red/20">
            <AlertCircle size={14} className="text-red flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red font-medium">
              Closing Disclosure must be delivered before the loan can be marked Clear to Close.
            </p>
          </div>
        )}

        {canEdit && !cdSentAt && tridStatus.cd !== 'not_applicable' && onMarkCDSent && closingDate && (
          <button
            onClick={onMarkCDSent}
            className="w-full h-8 rounded-[8px] bg-blue text-white text-[13px] font-medium hover:bg-blue/90 transition-colors"
          >
            Mark CD as Sent
          </button>
        )}
      </div>

      <p className="text-[11px] text-label-3 text-center">
        Business day calculations exclude Sundays and federal holidays per 12 CFR 1026.2(a)(6)
      </p>
    </div>
  );
}
