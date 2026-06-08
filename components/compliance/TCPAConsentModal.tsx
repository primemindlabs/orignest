'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { STANDARD_TCPA_CONSENT_TEXT } from '@/lib/compliance/tcpa';
import { ShieldCheck } from 'lucide-react';

interface TCPAConsentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (consentText: string) => Promise<void>;
  borrowerName: string;
  borrowerPhone: string;
}

export function TCPAConsentModal({
  open,
  onClose,
  onConfirm,
  borrowerName,
  borrowerPhone,
}: TCPAConsentModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!agreed) return;
    setLoading(true);
    try {
      await onConfirm(STANDARD_TCPA_CONSENT_TEXT);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setAgreed(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record SMS Consent"
      description="TCPA requires documented, explicit consent before sending automated SMS messages."
      size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="md" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            disabled={!agreed}
            loading={loading}
          >
            Record Consent
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Borrower info */}
        <div className="rounded-[10px] bg-bg p-3 space-y-1">
          <div className="flex justify-between text-[13px]">
            <span className="text-label-2">Borrower</span>
            <span className="font-medium text-black">{borrowerName}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-label-2">Phone</span>
            <span className="font-medium text-black">{borrowerPhone}</span>
          </div>
        </div>

        {/* Consent disclosure */}
        <div>
          <p className="text-[12px] font-semibold text-label-2 uppercase tracking-wide mb-2">
            Consent Disclosure Text
          </p>
          <div className="rounded-[10px] border border-[rgba(60,60,67,0.12)] bg-bg p-3">
            <p className="text-[13px] text-black leading-relaxed">
              {STANDARD_TCPA_CONSENT_TEXT}
            </p>
          </div>
        </div>

        {/* Attestation */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[rgba(60,60,67,0.3)] accent-blue"
          />
          <span className="text-[13px] text-black">
            I confirm that {borrowerName} verbally provided consent to receive automated SMS
            messages and has been read the disclosure above. The consent timestamp and my IP
            address will be recorded for compliance purposes.
          </span>
        </label>

        {/* Compliance note */}
        <div className="flex items-start gap-2 p-3 rounded-[10px] bg-blue/5 border border-blue/15">
          <ShieldCheck size={14} className="text-blue flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-blue">
            This consent record will be timestamped with your IP address and stored permanently
            in the audit log. Consent can be revoked by the borrower at any time by replying STOP.
          </p>
        </div>
      </div>
    </Modal>
  );
}
