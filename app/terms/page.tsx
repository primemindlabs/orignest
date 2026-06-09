import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'Terms of Service · Ashley AI' };

const LAST_UPDATED = 'June 8, 2026';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Home
        </Link>
        <h1 className="text-[28px] font-bold text-black tracking-tight mt-4">Terms of Service</h1>
        <p className="text-[13px] text-label-3 mt-1">Last updated {LAST_UPDATED}</p>

        <div className="mt-6 space-y-5 text-[14px] leading-relaxed text-label-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          <p>
            These Terms govern your access to and use of the Ashley AI application and services
            (the &ldquo;Service&rdquo;). By using the Service you agree to these Terms on behalf of
            yourself and your organization.
          </p>

          <Section title="Accounts & eligibility">
            <p>
              The Service is for use by licensed mortgage professionals and their authorized staff.
              You are responsible for the accuracy of your account information and for all activity
              under your credentials.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              You agree to use the Service in compliance with applicable law, including TRID, TCPA,
              ECOA, RESPA, and state licensing rules. You will not misuse the Service, attempt to
              access it without authorization, or use it to send communications without required
              consent.
            </p>
          </Section>

          <Section title="Customer data">
            <p>
              Your organization retains ownership of the borrower and loan data it submits. You grant
              us a limited license to process that data solely to provide and improve the Service.
              Our handling of personal information is described in our{' '}
              <Link href="/privacy" className="text-gold-700 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="Compliance disclaimer">
            <p>
              The Service provides tools and reminders to support compliance but does not constitute
              legal, financial, or compliance advice. You remain responsible for your regulatory
              obligations and for reviewing all disclosures and communications before they are sent.
            </p>
          </Section>

          <Section title="Subscription & termination">
            <p>
              Paid plans are billed per the order you select. Either party may terminate per the
              applicable order. On termination, you may export your data for a reasonable period
              after which it may be deleted.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              The Service is provided &ldquo;as is.&rdquo; To the maximum extent permitted by law, we
              are not liable for indirect, incidental, or consequential damages arising from your use
              of the Service.
            </p>
          </Section>

          <p className="text-[12px] text-label-3 border-t border-border pt-4">
            This document is a template provided for transparency and is pending review by legal
            counsel before public launch. It does not yet constitute final legal terms.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-[16px] font-semibold text-black">{title}</h2>
      {children}
    </div>
  );
}
