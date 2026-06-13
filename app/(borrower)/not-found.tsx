// Branded fallback for any not-found in the borrower portal (invalid/expired tokens
// that call notFound() reach here). Next.js not-found pages receive no params, so this
// renders the generic variant; the status page renders the LO-aware variant directly
// for resolvable-but-expired tokens.
import { PortalLinkExpired } from '@/components/portal/PortalLinkExpired';

export const metadata = { title: 'Link not available', robots: 'noindex' };

export default function BorrowerNotFound() {
  return <PortalLinkExpired variant="invalid" />;
}
