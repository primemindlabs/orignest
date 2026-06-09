/** Phase 64.1 — PUBLIC title-company portal shell (unauthenticated, token-gated). */
import { TitlePortalClient } from './TitlePortalClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Title Portal', robots: 'noindex' };

export default function TitlePortalPage({ params }: { params: { token: string } }) {
  return <TitlePortalClient token={params.token} />;
}
