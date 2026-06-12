// Phase 106 — short borrower-portal URL (ashleyiq.com/b/<token>). The spec's
// portal already lives at /status/[token]; this is just a public redirect so the
// shorter /b/ link resolves to it. No second portal.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ShortPortalRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/status/${token}`);
}
