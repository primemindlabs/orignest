/**
 * Phase 52.1 — PUBLIC pre-approval certificate (unauthenticated, token-gated).
 * Service-role lookup by SHA-256(token). Revoked/expired → expired state (never
 * 404, no enumeration). Increments view_count. White-labeled as the LO + company.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pre-Approval Certificate', robots: 'noindex' };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Expired() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F1D2E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ maxWidth: 380, background: '#F5EFE0', borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
        <p style={{ fontSize: 26, marginBottom: 8 }}>⏳</p>
        <p style={{ color: '#0F1D2E', fontWeight: 600, fontSize: 16 }}>This certificate is no longer available</p>
        <p style={{ color: '#6B7B8D', fontSize: 13, marginTop: 6 }}>It may have expired or been withdrawn. Please contact your loan officer for an updated pre-approval.</p>
      </div>
    </div>
  );
}

export default async function CertificatePage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: cert } = await sb.from('pre_approval_certificates').select('*').eq('token_hash', sha256(params.token)).maybeSingle();
  if (!cert || cert.is_revoked || new Date(cert.expiration_date) < new Date(new Date().toDateString())) return <Expired />;

  // Fire-and-forget view increment.
  sb.from('pre_approval_certificates').update({ view_count: (cert.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() }).eq('id', cert.id).then(() => undefined, () => undefined);

  const daysLeft = Math.ceil((new Date(cert.expiration_date).getTime() - Date.now()) / 86_400_000);
  const expiringSoon = daysLeft <= 7;
  const initials = cert.lo_name.split(' ').map((s: string) => s[0]).slice(0, 2).join('');

  return (
    <div style={{ minHeight: '100vh', background: '#0F1D2E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#F5EFE0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ background: '#C9A95C', padding: '24px 32px', textAlign: 'center' }}>
          <p style={{ color: '#0F1D2E', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Pre-Approval Certificate</p>
          <p style={{ color: '#0F1D2E', fontSize: 12, opacity: 0.7 }}>Valid through {new Date(cert.expiration_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#6B7B8D', fontSize: 13, marginBottom: 8 }}>Approved for up to</p>
          <p style={{ fontSize: 44, color: '#0F1D2E', fontWeight: 700, letterSpacing: -1 }}>{fmt(Number(cert.approved_amount))}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            <span style={{ background: 'rgba(15,29,46,0.1)', color: '#0F1D2E', fontSize: 12, padding: '4px 12px', borderRadius: 999 }}>{cert.loan_type}</span>
            {cert.property_type && <span style={{ background: 'rgba(15,29,46,0.1)', color: '#0F1D2E', fontSize: 12, padding: '4px 12px', borderRadius: 999 }}>{cert.property_type}</span>}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(15,29,46,0.1)', margin: '0 32px' }} />

        <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {cert.lo_headshot_url
            ? <img src={cert.lo_headshot_url} alt={cert.lo_name} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover' }} />
            : <div style={{ width: 48, height: 48, borderRadius: 999, background: 'rgba(15,29,46,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F1D2E', fontWeight: 600 }}>{initials}</div>}
          <div style={{ flex: 1 }}>
            <p style={{ color: '#0F1D2E', fontWeight: 600, fontSize: 14 }}>{cert.lo_name}</p>
            <p style={{ color: '#6B7B8D', fontSize: 12 }}>{cert.company_name}</p>
            {cert.lo_nmls && <p style={{ color: '#6B7B8D', fontSize: 12 }}>NMLS #{cert.lo_nmls}</p>}
          </div>
          {cert.lo_phone && <a href={`tel:${cert.lo_phone}`} style={{ background: '#C9A95C', color: '#0F1D2E', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 999, textDecoration: 'none' }}>Call Now</a>}
        </div>

        {expiringSoon && <div style={{ background: '#FFF7ED', borderTop: '1px solid #FED7AA', padding: '12px 32px', fontSize: 12, color: '#B45309', textAlign: 'center' }}>This certificate expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}</div>}

        <div style={{ padding: '16px 32px', background: 'rgba(15,29,46,0.05)' }}>
          <p style={{ color: '#6B7B8D', fontSize: 10, lineHeight: 1.6 }}>This pre-approval is based on the information provided and is not a commitment to lend. Final approval is subject to property appraisal, title search, and underwriting review.</p>
        </div>
      </div>
    </div>
  );
}
