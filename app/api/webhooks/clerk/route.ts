import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    first_name: string | null;
    last_name: string | null;
    profile_image_url: string | null;
    primary_email_address_id: string | null;
    public_metadata: Record<string, unknown>;
  };
}

interface ClerkOrgCreatedEvent {
  type: 'organization.created';
  data: {
    id: string;
    name: string;
    slug: string | null;
    created_by: string;
  };
}

interface ClerkOrgMembershipCreatedEvent {
  type: 'organizationMembership.created';
  data: {
    id: string;
    role: string;
    organization: {
      id: string;
      name: string;
    };
    public_user_data: {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      profile_image_url: string | null;
      identifier: string;
    };
  };
}

type ClerkEvent = ClerkUserCreatedEvent | ClerkOrgCreatedEvent | ClerkOrgMembershipCreatedEvent;

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[clerk/webhook] CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const headersList = headers();
  const svixId = headersList.get('svix-id');
  const svixTimestamp = headersList.get('svix-timestamp');
  const svixSignature = headersList.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await req.text();

  let event: ClerkEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error('[clerk/webhook] Verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const sb = createAdminClient();

  try {
    switch (event.type) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, profile_image_url, primary_email_address_id } = event.data;

        const primaryEmail = email_addresses.find(
          (e) => e.id === primary_email_address_id
        )?.email_address ?? email_addresses[0]?.email_address ?? '';

        // Create profile stub — org_id will be set when they join an org
        await sb.from('profiles').upsert(
          {
            clerk_user_id: id,
            email: primaryEmail,
            first_name: first_name ?? '',
            last_name: last_name ?? '',
            role: 'loan_officer',
            avatar_url: profile_image_url,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'clerk_user_id', ignoreDuplicates: false }
        );
        break;
      }

      case 'organization.created': {
        const { id, name, created_by } = event.data;

        // Create org record with 14-day trial
        await sb.from('organizations').upsert(
          {
            clerk_org_id: id,
            name,
            subscription_plan: 'starter',
            subscription_status: 'trialing',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'clerk_org_id', ignoreDuplicates: false }
        );

        // Update the creator's profile with this org
        const { data: org } = await sb
          .from('organizations')
          .select('id')
          .eq('clerk_org_id', id)
          .maybeSingle();

        if (org?.id) {
          await sb
            .from('profiles')
            .update({ org_id: org.id, role: 'admin', updated_at: new Date().toISOString() })
            .eq('clerk_user_id', created_by)
            .is('org_id', null);
        }
        break;
      }

      case 'organizationMembership.created': {
        const { role, organization, public_user_data } = event.data;

        const { data: org } = await sb
          .from('organizations')
          .select('id')
          .eq('clerk_org_id', organization.id)
          .maybeSingle();

        if (!org?.id) break;

        // Map Clerk role to Conduit role
        const conduitRole =
          role === 'org:admin' ? 'admin' : role === 'org:manager' ? 'branch_manager' : 'loan_officer';

        await sb
          .from('profiles')
          .update({
            org_id: org.id,
            role: conduitRole,
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', public_user_data.user_id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[clerk/webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
