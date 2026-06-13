// Branded expired/invalid borrower-portal link page (replaces the bare Next.js 404).
// Server component — gold accent, white surface, NO navy. Shows the loan officer's
// contact when it can be resolved, otherwise a generic "contact your loan officer".
import { IconLockExclamation, IconMail, IconPhone } from '@tabler/icons-react';

export function PortalLinkExpired({
  variant = 'expired',
  loName,
  loEmail,
  loPhone,
}: {
  variant?: 'expired' | 'invalid';
  loName?: string | null;
  loEmail?: string | null;
  loPhone?: string | null;
}) {
  const expired = variant === 'expired';
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-5 py-10 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#EDEAE4] shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[#FBF5E6] flex items-center justify-center mx-auto mb-5">
          <IconLockExclamation size={26} className="text-[#C9A95C]" />
        </div>
        <h1 className="text-[20px] font-semibold text-[#1A1816] tracking-tight">
          {expired ? 'This link has expired' : 'We couldn’t find that link'}
        </h1>
        <p className="text-[13.5px] text-[#6B6560] mt-2 leading-relaxed">
          {expired
            ? 'For your security, portal links expire after a period of inactivity. Your loan officer can send you a fresh link in seconds.'
            : 'This portal link is no longer valid. Your loan officer can send you a new one.'}
        </p>

        {loName ? (
          <div className="mt-6 rounded-xl border border-[#EDEAE4] bg-[#FAFAF8] p-4">
            <p className="text-[11px] uppercase tracking-wide text-[#9B9590]">Your loan officer</p>
            <p className="text-[14px] font-medium text-[#1A1816] mt-0.5">{loName}</p>
            {(loEmail || loPhone) && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {loEmail && (
                  <a href={`mailto:${loEmail}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A95C] text-white px-3.5 py-2 text-[13px] font-medium hover:brightness-95 transition">
                    <IconMail size={14} /> Email
                  </a>
                )}
                {loPhone && (
                  <a href={`tel:${loPhone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A95C] text-[#8C6B2A] px-3.5 py-2 text-[13px] font-medium hover:bg-[#FBF5E6] transition">
                    <IconPhone size={14} /> Call
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12.5px] text-[#6B6560] mt-5">Please reach out to your loan officer to request a new link.</p>
        )}
      </div>
    </div>
  );
}
