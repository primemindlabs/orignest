// Phase 105 — public application fetch (no auth; token is the key). Service-role
// admin client gated by token, mirroring the certificate / title-portal public pages.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const sb = createAdminClient();

  const { data: application } = await sb
    .from('applications')
    .select('*')
    .eq('token', token)
    .neq('status', 'submitted')
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ error: 'Application not found or already submitted' }, { status: 404 });
  }

  const { data: sections } = await sb
    .from('application_section_progress')
    .select('*')
    .eq('application_id', application.id);

  return NextResponse.json({ application, sections: sections ?? [] });
}
