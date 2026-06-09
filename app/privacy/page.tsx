import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'Privacy Policy · Ashley AI' };

const LAST_UPDATED = 'June 8, 2026';

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={LAST_UPDATED}>
      <p>
        Ashley AI (&ldquo;Ashley AI&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides software
        for licensed mortgage loan originators and their teams. This policy explains what we
        collect, how we use it, and the choices you have. It applies to our web application and
        related services.
      </p>

      <Section title="Information we collect">
        <ul>
          <li>
            <strong>Account data</strong> — name, email, organization, NMLS identifiers, and role,
            provided when you or your administrator create an account.
          </li>
          <li>
            <strong>Borrower and loan data</strong> — information your organization enters or
            imports about its leads and loans. Sensitive identifiers (SSN, date of birth) are
            encrypted at the application layer before storage.
          </li>
          <li>
            <strong>Usage data</strong> — log and device information used to operate, secure, and
            improve the service.
          </li>
        </ul>
      </Section>

      <Section title="How we use information">
        <p>
          We use information to provide and secure the service, to communicate with you, and to
          meet legal and compliance obligations. We do not sell personal information. SMS and voice
          outreach is sent only where a valid consent (TCPA) is recorded.
        </p>
      </Section>

      <Section title="Data sharing">
        <p>
          We share data with sub-processors that help us run the service (hosting, authentication,
          messaging, payments) under contractual confidentiality and security obligations, and where
          required by law. Each customer&rsquo;s data is logically isolated by organization.
        </p>
      </Section>

      <Section title="Security & retention">
        <p>
          We use access controls, encryption in transit, and application-layer encryption for
          sensitive identifiers. We retain data for as long as your organization maintains its
          account or as required by law, then delete or de-identify it.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You may access, correct, or request deletion of personal information by contacting your
          organization administrator or us at{' '}
          <a href="mailto:privacy@ashleyiq.com" className="text-gold-700 underline">
            privacy@ashleyiq.com
          </a>
          . Consumers may opt out of SMS by replying STOP.
        </p>
      </Section>

      <p className="text-[12px] text-label-3 border-t border-border pt-4">
        This document is a template provided for transparency and is pending review by legal
        counsel before public launch. It does not yet constitute final legal terms.
      </p>
    </LegalShell>
  );
}

function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
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
        <h1 className="text-[28px] font-bold text-black tracking-tight mt-4">{title}</h1>
        <p className="text-[13px] text-label-3 mt-1">Last updated {updated}</p>
        <div className="prose-legal mt-6 space-y-5 text-[14px] leading-relaxed text-label-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-gold-700">
          {children}
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
