import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ListingsHub } from './ListingsHub';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Listings & Co-Marketing' };

export default async function ListingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: listings } = await sb
    .from('realtor_listings')
    .select('id, address_line1, address_city, address_state, list_price, bedrooms, bathrooms, sqft, primary_photo_url, listing_status, source')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/co-marketing" className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors">
          <ArrowLeft size={14} /> Co-Marketing
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">Listings &amp; Flyers</h1>
        <p className="text-label-2 text-sm mt-0.5">Import a listing from Zillow or add one manually, then generate a co-branded flyer.</p>
      </div>
      <ListingsHub initial={(listings ?? []) as any} />
    </div>
  );
}
