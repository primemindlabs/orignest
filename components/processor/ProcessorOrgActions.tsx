'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, LogOut } from 'lucide-react';

interface Props {
  assignmentId: string;
  orgId: string;
  status: 'pending' | 'active' | 'suspended';
  orgName: string;
}

export function ProcessorOrgActions({ assignmentId, orgId, status, orgName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accepting, setAccepting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch('/api/processor/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to accept invitation.');
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="primary"
          size="sm"
          loading={accepting}
          leftIcon={<CheckCircle2 size={13} />}
          onClick={handleAccept}
        >
          Accept Invite
        </Button>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
    );
  }

  if (status === 'active') {
    if (confirmLeave) {
      return (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-label-2">Leave {orgName}?</span>
          <Button
            variant="danger"
            size="sm"
            loading={isPending}
            onClick={() => {
              // Leaving is handled by contacting the org admin — self-leave not in v1
              setConfirmLeave(false);
            }}
          >
            Confirm
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmLeave(false)}
          >
            Cancel
          </Button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setConfirmLeave(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-xs font-medium text-label-3 hover:text-red hover:bg-red/8 transition-colors"
        title="Leave organization"
      >
        <LogOut size={13} />
        Leave
      </button>
    );
  }

  return null;
}
