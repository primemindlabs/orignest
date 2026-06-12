import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCompliantEmail } from '@/lib/resend';
import twilio from 'twilio';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient();
  const sbAdmin = createAdminClient();

  const { data: org } = await sb
    .from('organizations')
    .select('id, name')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name, email, nmls_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!org || !profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const videoFile = formData.get('video') as File | null;
  const leadId = formData.get('leadId') as string | null;
  const title = (formData.get('title') as string | null) ?? 'Video message';
  const durationRaw = formData.get('duration') as string | null;
  const channel = (formData.get('channel') as 'email' | 'sms' | null) ?? 'email';
  const message = (formData.get('message') as string | null) ?? '';

  if (!videoFile) {
    return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const videoId = crypto.randomUUID();
  const storagePath = `video-messages/${org.id}/${videoId}.webm`;

  const arrayBuffer = await videoFile.arrayBuffer();
  const { error: uploadError } = await sbAdmin.storage
    .from('video-messages')
    .upload(storagePath, arrayBuffer, {
      contentType: 'video/webm',
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[video-messages] Upload error:', uploadError.message);
    return NextResponse.json({ error: 'Video upload failed' }, { status: 500 });
  }

  // ── Get public URL ─────────────────────────────────────────────────────────
  const { data: publicUrlData } = sbAdmin.storage
    .from('video-messages')
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData.publicUrl;
  const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/video/${videoId}`;

  // ── Insert video_messages record ───────────────────────────────────────────
  const { error: dbError } = await sb.from('video_messages').insert({
    id: videoId,
    org_id: org.id,
    lo_id: profile.id,
    lead_id: leadId ?? null,
    storage_path: storagePath,
    public_url: viewUrl,
    thumbnail_url: null, // TODO: generate thumbnail via edge function
    duration_seconds: durationRaw ? parseInt(durationRaw, 10) : null,
    title,
  });

  if (dbError) {
    console.error('[video-messages] DB insert error:', dbError.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // ── Look up lead for delivery ──────────────────────────────────────────────
  if (leadId) {
    const { data: lead } = await sb
      .from('leads')
      .select('first_name, last_name, email, phone, sms_consent')
      .eq('id', leadId)
      .maybeSingle();

    if (lead) {
      const videoLinkMsg = message.replace('{{VIDEO_LINK}}', viewUrl);
      const loName = `${profile.first_name} ${profile.last_name}`;

      if (channel === 'email') {
        await sendCompliantEmail({
          to: lead.email,
          recipientEmail: lead.email,
          orgId: org.id,
          subject: `${loName} sent you a video message`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1c1c1e;">
              <h2 style="font-size:20px;margin-bottom:8px;">${title}</h2>
              <p style="color:#6C6C70;margin-bottom:24px;">From ${loName}</p>
              ${videoLinkMsg ? `<p style="margin-bottom:24px;">${videoLinkMsg.replace(/\n/g, '<br/>')}</p>` : ''}
              <a href="${viewUrl}" style="display:inline-block;background:#007AFF;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">
                ▶ Watch Video
              </a>
              <p style="margin-top:32px;font-size:12px;color:#AEAEB2;">
                ${profile.first_name} ${profile.last_name}${profile.nmls_id ? ` · NMLS #${profile.nmls_id}` : ''}
              </p>
            </div>
          `,
        });
      } else if (channel === 'sms' && lead.sms_consent && lead.phone) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (accountSid && authToken && fromNumber) {
          const client = twilio(accountSid, authToken);
          const smsBody = videoLinkMsg
            ? `${videoLinkMsg}\n\n${viewUrl}`
            : `Hi ${lead.first_name}, ${loName} sent you a video message: ${viewUrl}`;
          await client.messages.create({
            to: lead.phone,
            from: fromNumber,
            body: smsBody.slice(0, 1600),
          });
        }
      }

      // Log to communications
      await sb.from('communications').insert({
        lead_id: leadId,
        org_id: org.id,
        sender_id: profile.id,
        channel: channel === 'sms' ? 'sms' : 'email',
        direction: 'outbound',
        subject: title,
        body: `Video message: ${viewUrl}`,
        consent_status_at_send: true,
        sent_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ ok: true, videoId, viewUrl });
}
