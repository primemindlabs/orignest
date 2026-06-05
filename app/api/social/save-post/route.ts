import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface SavePostRequest {
  platform: string;
  contentType: string;
  tone: string;
  body: string;
  hashtags: string[];
  complianceFlag: boolean;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as SavePostRequest;
    const { platform, contentType, tone, body: postBody, hashtags, complianceFlag } = body;

    if (!platform || !contentType || !postBody) {
      return NextResponse.json({ error: 'platform, contentType, and body are required' }, { status: 400 });
    }

    // Get the profile for created_by
    const sb = createClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: post, error: insertError } = await admin
      .from('social_posts')
      .insert({
        org_id: org.id,
        created_by: profile.id,
        platform,
        content_type: contentType,
        tone,
        body: postBody,
        hashtags,
        status: 'draft',
        compliance_flag: complianceFlag,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[social/save-post] insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(post);
  } catch (err) {
    console.error('[social/save-post] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
