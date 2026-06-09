'use client';

/**
 * Phase 19 — Buyer-experience widgets for the borrower portal.
 * Closing countdown, first-payment reminder, and a moving checklist. All are
 * derived from the loan stage + closing date the portal already exposes (no new
 * financial PII). The moving checklist persists locally per portal token.
 */
import { useState, useEffect } from 'react';
import { CalendarClock, PartyPopper, Truck, CreditCard, CheckCircle, Circle, Share2 } from 'lucide-react';

const NEAR_CLOSING_STAGES = ['clear_to_close', 'closing_scheduled', 'closed'];
const CERT_STAGES = ['pre_qualified', 'pre_qual', 'application_complete', 'conditional_approval', 'clear_to_close'];

const MOVING_TASKS = [
  'Set up mail forwarding with USPS',
  'Schedule movers or a moving truck',
  'Transfer utilities (power, water, gas, internet)',
  'Update your address with banks and employer',
  'Confirm homeowners insurance is active on closing day',
  'Schedule a final walkthrough',
  'Set aside certified funds for closing',
];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// First payment is conventionally the 1st of the month after a full month following closing.
function firstPaymentDate(closingDateStr: string): Date {
  const c = new Date(closingDateStr);
  return new Date(c.getFullYear(), c.getMonth() + 2, 1);
}

export function BorrowerJourneyWidgets({
  token,
  currentStage,
  closingDate,
}: {
  token: string;
  currentStage: string;
  closingDate: string | null;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const storageKey = `moving-checklist-${token}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle(i: number) {
    setChecked((cur) => {
      const next = { ...cur, [i]: !cur[i] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const isClosed = currentStage === 'closed';
  const days = closingDate ? daysUntil(closingDate) : null;
  const showCountdown = !isClosed && days !== null && days >= 0;
  const showMoving =
    NEAR_CLOSING_STAGES.includes(currentStage) || (days !== null && days <= 60 && days >= -7);
  const showFirstPayment = isClosed || (closingDate !== null && currentStage === 'clear_to_close');
  const showCert = CERT_STAGES.includes(currentStage);

  const completedCount = MOVING_TASKS.filter((_, i) => checked[i]).length;

  return (
    <>
      {/* Closing countdown */}
      {showCountdown && (
        <div className="bg-gradient-to-br from-gold-50 to-white border border-gold-200 rounded-[10px] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={16} className="text-gold-600" />
            <p className="text-xs font-semibold text-gold-700">Closing countdown</p>
          </div>
          <p className="text-3xl font-bold text-label tracking-tight">
            {days === 0 ? 'Closing today!' : `${days} day${days === 1 ? '' : 's'}`}
          </p>
          {days! > 0 && (
            <p className="text-sm text-label-2 mt-0.5">
              until your expected closing on{' '}
              {new Date(closingDate!).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}
              .
            </p>
          )}
        </div>
      )}

      {/* Closed celebration */}
      {isClosed && (
        <div className="bg-gradient-to-br from-green/10 to-white border border-green/20 rounded-[10px] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <PartyPopper size={16} className="text-green" />
            <p className="text-xs font-semibold text-green">Congratulations!</p>
          </div>
          <p className="text-lg font-bold text-label">Your loan has closed. Welcome home. 🏡</p>
        </div>
      )}

      {/* First-payment reminder */}
      {showFirstPayment && closingDate && (
        <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={16} className="text-navy" />
            <h2 className="text-sm font-semibold text-label">First payment</h2>
          </div>
          <p className="text-sm text-label-2 leading-relaxed">
            Your first mortgage payment is typically due{' '}
            <span className="font-semibold text-label">
              {firstPaymentDate(closingDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            . Your servicer will confirm the exact date and amount in your welcome packet.
          </p>
        </div>
      )}

      {/* Moving checklist */}
      {showMoving && hydrated && (
        <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-navy" />
              <h2 className="text-sm font-semibold text-label">Moving checklist</h2>
            </div>
            <span className="text-xs text-label-3">
              {completedCount}/{MOVING_TASKS.length} done
            </span>
          </div>
          <div className="space-y-2">
            {MOVING_TASKS.map((task, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="flex items-center gap-3 w-full text-left"
              >
                {checked[i] ? (
                  <CheckCircle size={17} className="text-green flex-shrink-0" />
                ) : (
                  <Circle size={17} className="text-label-3 flex-shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    checked[i] ? 'text-label-3 line-through' : 'text-label'
                  }`}
                >
                  {task}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shareable pre-approval certificate */}
      {showCert && (
        <a
          href={`/cert/${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 bg-navy text-white rounded-[10px] p-4 shadow-card hover:bg-navy/90 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Share2 size={16} className="text-gold" />
            <div>
              <p className="text-sm font-semibold">Share your pre-approval</p>
              <p className="text-xs text-white/70">Send a certificate to your real estate agent.</p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">Open</span>
        </a>
      )}
    </>
  );
}
