import { requirePlatformAdmin } from '@/lib/admin/guards';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/tenants', label: 'Tenants' },
];

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin(); // 404 for everyone unless PRIMEMIND_ADMIN_ORG_ID matches.

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="bg-[#0F1D2E] text-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <span className="text-[14px] font-bold">Ashley IQ · Platform Admin</span>
          <nav className="flex items-center gap-4">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-[13px] text-white/80 hover:text-white">{n.label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
