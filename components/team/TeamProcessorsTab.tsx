'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { UserPlus, FileText, CheckCircle2, Clock, ShieldOff, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  processor_clerk_id: string;
  status: 'pending' | 'active' | 'suspended';
  permissions: Record<string, boolean>;
  created_at: string;
  accepted_at: string | null;
}

interface Props {
  assignments: Assignment[];
  filesByProcessor: Record<string, number>;
  orgId: string;
}

export function TeamProcessorsTab({ assignments, filesByProcessor, orgId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [permissions, setPermissions] = useState({
    view_leads: true,
    edit_conditions: true,
    upload_docs: true,
    view_financials: false,
  });

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);

    try {
      const res = await fetch('/api/processor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processorEmail: inviteEmail.trim(), permissions }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error ?? 'Failed to send invitation.');
      } else {
        setInviteSuccess(true);
        setInviteEmail('');
        setShowInviteForm(false);
        startTransition(() => router.refresh());
      }
    } catch {
      setInviteError('Network error. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(assignmentId: string) {
    setRevoking(assignmentId);
    try {
      await fetch('/api/processor/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });
      startTransition(() => router.refresh());
    } catch {
      // silently fail — user can retry
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Actions bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-label-2">
          External processors who can work on this brokerage&apos;s loan files.
        </p>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<UserPlus size={13} />}
          onClick={() => { setShowInviteForm(!showInviteForm); setInviteSuccess(false); }}
        >
          Invite Processor
        </Button>
      </div>

      {/* ── Invite form ───────────────────────────────────────────────── */}
      {showInviteForm && (
        <div className="bg-surface rounded-card shadow-card border border-border p-5 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-black">Invite External Processor</h3>
          <p className="text-xs text-label-2">
            The processor must already have an Orignest account. They&apos;ll receive an email to accept.
          </p>

          <div>
            <label className="block text-xs font-medium text-label-2 mb-1">Processor Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="processor@example.com"
              className="w-full h-9 px-3 rounded-[8px] bg-fill border border-border text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-label-2 mb-2">Permissions</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(permissions) as [keyof typeof permissions, boolean][]).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-xs text-black capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {inviteError && <p className="text-xs text-red">{inviteError}</p>}

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={inviting}
              leftIcon={<Mail size={13} />}
              onClick={handleInvite}
              disabled={!inviteEmail.trim()}
            >
              Send Invitation
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInviteForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {inviteSuccess && (
        <div className="bg-green/8 border border-green/20 rounded-card px-4 py-3 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={14} className="text-green" />
          <p className="text-sm text-green font-medium">Invitation sent successfully.</p>
        </div>
      )}

      {/* ── Processor list ────────────────────────────────────────────── */}
      {assignments.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={22} className="text-label-3" />}
          title="No processors yet"
          description="Invite an external processor to manage conditions and milestones for your loan files."
        />
      ) : (
        <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {assignments.map((a) => {
              const fileCount = filesByProcessor[a.processor_clerk_id] ?? 0;
              const perms = a.permissions;

              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-semibold text-blue">PR</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-black font-mono text-[12px] text-label-2">
                        {a.processor_clerk_id.slice(0, 12)}…
                      </p>
                      <Badge
                        variant={a.status === 'active' ? 'success' : a.status === 'pending' ? 'warning' : 'danger'}
                        size="sm"
                        dot
                      >
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] text-label-3">
                        <FileText size={11} />
                        {fileCount} {fileCount === 1 ? 'file' : 'files'}
                      </span>
                      {a.accepted_at ? (
                        <span className="flex items-center gap-1 text-[11px] text-label-3">
                          <CheckCircle2 size={11} className="text-green" />
                          Accepted {format(new Date(a.accepted_at), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-label-3">
                          <Clock size={11} />
                          Invited {format(new Date(a.created_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {perms.view_leads && <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full">View Leads</span>}
                      {perms.edit_conditions && <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full">Edit Conditions</span>}
                      {perms.upload_docs && <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full">Upload Docs</span>}
                      {perms.view_financials && <span className="text-[10px] bg-blue/10 text-blue px-1.5 py-0.5 rounded-full">Financials</span>}
                    </div>
                  </div>

                  {a.status !== 'suspended' && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={revoking === a.id}
                      leftIcon={<ShieldOff size={12} />}
                      onClick={() => handleRevoke(a.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
