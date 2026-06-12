// Phase 87 — Deepgram Nova-2 transcription (gated). Returns null when not configured or on
// error so the caller can degrade gracefully (never blocks the call record).

export async function transcribeWithDeepgram(
  recordingUrl: string,
): Promise<{ transcript: string; requestId: string | null } | null> {
  if (!process.env.DEEPGRAM_API_KEY) return null;
  try {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: recordingUrl }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const transcript: string = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    const requestId: string | null = data?.metadata?.request_id ?? null;
    return { transcript, requestId };
  } catch (e) {
    console.error('[deepgram]', e);
    return null;
  }
}

export const deepgramConfigured = () => Boolean(process.env.DEEPGRAM_API_KEY);
