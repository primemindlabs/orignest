'use client';

import { useEffect, useMemo, useState } from 'react';

export type CheckItem = {
  id: string;
  label: string;
  detail: string;
};

const ITEMS: CheckItem[] = [
  {
    id: 'no_realtor_dual',
    label: 'The loan originator is not also the real estate agent on this transaction.',
    detail:
      'Acting as both the mortgage originator and the listing/selling agent on the same property creates a non-exempt dual role and a conflict of interest. Confirm the referring agent is a separate, arms-length party.',
  },
  {
    id: 'no_undisclosed_affiliate',
    label: 'No affiliated business arrangement (ABA) exists that has not been disclosed.',
    detail:
      'Under RESPA Section 8(c)(4), referrals to an affiliated provider (title, escrow, appraisal, insurance) are only permitted when the Affiliated Business Arrangement Disclosure is given at or before referral, the borrower is free to shop, and no fee is paid for the referral itself.',
  },
  {
    id: 'no_referral_fee',
    label: 'No thing of value is being exchanged for referrals on this file.',
    detail:
      'RESPA Section 8(a) prohibits giving or accepting any fee, kickback, or thing of value for the referral of settlement-service business. Marketing services agreements and co-marketing must reflect fair-market value for actual services rendered.',
  },
  {
    id: 'borrower_free_to_shop',
    label: 'The borrower is free to choose their own settlement-service providers.',
    detail:
      'The borrower must not be required to use any particular title, escrow, or other affiliated provider as a condition of the loan. Any "use of estimated charges only" provider list must be informational.',
  },
  {
    id: 'no_required_use',
    label: 'There is no prohibited "required use" of an affiliated provider.',
    detail:
      'Incentives or pricing that effectively force the borrower to an affiliate constitute "required use" under RESPA and are not protected by the affiliated-business exemption.',
  },
  {
    id: 'comp_independent',
    label: 'LO compensation does not vary based on referral of affiliated business.',
    detail:
      'Loan originator compensation must not be tied to the borrower’s selection of any affiliated settlement provider, consistent with both RESPA and the LO Compensation Rule.',
  },
];

export function DualRoleChecklist({
  loanId,
  realtorContext,
}: {
  loanId: string;
  realtorContext: { name: string; brokerage: string | null } | null;
}) {
  const storageKey = `dual-role-check:${loanId}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reviewer, setReviewer] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { checked?: Record<string, boolean>; reviewer?: string };
        setChecked(parsed.checked ?? {});
        setReviewer(parsed.reviewer ?? '');
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ checked, reviewer }));
    } catch {
      /* ignore quota/unavailable storage */
    }
  }, [checked, reviewer, hydrated, storageKey]);

  const toggle = (id: string) =>
    setChecked((c) => ({ ...c, [id]: !c[id] }));

  const completeCount = useMemo(
    () => ITEMS.filter((i) => checked[i.id]).length,
    [checked],
  );
  const allClear = completeCount === ITEMS.length;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className="rounded-[14px] border p-4 flex items-center gap-4"
        style={{
          borderColor: allClear ? 'var(--c-success, #16a34a)' : 'var(--c-border)',
          background: 'var(--c-surface)',
        }}
      >
        <div className="text-center min-w-[64px]">
          <p
            className="text-[26px] font-bold tabular-nums leading-none"
            style={{ color: allClear ? 'var(--c-success, #16a34a)' : 'var(--c-gold-deep)' }}
          >
            {completeCount}/{ITEMS.length}
          </p>
          <p className="text-[10px] text-[var(--c-label3)] mt-1 uppercase tracking-wide">Confirmed</p>
        </div>
        <div className="border-l border-[var(--c-border)] pl-4">
          <p
            className="text-[14px] font-semibold"
            style={{ color: allClear ? 'var(--c-success, #16a34a)' : 'var(--c-text)' }}
          >
            {allClear ? 'No prohibited dual role identified' : 'Review incomplete'}
          </p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5 leading-relaxed max-w-md">
            {allClear
              ? 'All RESPA / affiliated-business attestations confirmed for this file.'
              : 'Confirm each item below after verifying the facts of this transaction.'}
          </p>
        </div>
      </div>

      {/* Linked-party context */}
      {realtorContext && (
        <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-fill)] p-4">
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide mb-1">Referring agent on file</p>
          <p className="text-[13px] font-semibold text-[var(--c-text)]">{realtorContext.name}</p>
          {realtorContext.brokerage && (
            <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{realtorContext.brokerage}</p>
          )}
          <p className="text-[11px] text-[var(--c-label3)] mt-2 leading-relaxed">
            Verify this party is independent of the loan originator and that any affiliated arrangement is disclosed.
          </p>
        </div>
      )}

      {/* Checklist */}
      <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] divide-y divide-[var(--c-border)]">
        {ITEMS.map((item) => {
          const on = !!checked[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className="w-full text-left p-4 flex gap-3 items-start hover:bg-[var(--c-fill)] transition-colors"
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-[11px] font-bold"
                style={{
                  borderColor: on ? 'var(--c-success, #16a34a)' : 'var(--c-border)',
                  background: on ? 'var(--c-success, #16a34a)' : 'transparent',
                  color: on ? '#fff' : 'transparent',
                }}
              >
                {on ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[13px] font-medium"
                  style={{ color: on ? 'var(--c-label2)' : 'var(--c-text)' }}
                >
                  {item.label}
                </span>
                <span className="block text-[12px] text-[var(--c-label3)] mt-1 leading-relaxed">
                  {item.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Reviewer sign-off */}
      <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <label className="block text-[12px] font-medium text-[var(--c-text)] mb-1.5">
          Reviewed by
        </label>
        <input
          type="text"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="Name of reviewer"
          className="w-full max-w-xs rounded-[8px] border border-[var(--c-border)] bg-[var(--c-fill)] px-3 py-2 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-gold-deep)]"
        />
        <p className="text-[11px] text-[var(--c-label3)] mt-2 leading-relaxed">
          This attestation is saved locally to your browser for this loan. It is an internal review aid and does not
          replace your compliance department’s formal RESPA sign-off.
        </p>
      </div>
    </div>
  );
}
