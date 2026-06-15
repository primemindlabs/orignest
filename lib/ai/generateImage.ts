/**
 * Phase 138 — AI image generation for the Design Studio. Provider-agnostic:
 * uses fal.ai (Flux) when FAL_KEY is set, else Replicate when REPLICATE_API_TOKEN
 * is set. Returns a hosted image URL. Throws ImageGenNotConfigured when neither
 * key is present so callers can show a clean "add a key" state.
 */
import 'server-only';

export class ImageGenNotConfigured extends Error {
  constructor() {
    super('No image generation provider configured (set FAL_KEY or REPLICATE_API_TOKEN).');
    this.name = 'ImageGenNotConfigured';
  }
}

export function isImageGenConfigured(): boolean {
  return !!(process.env.FAL_KEY || process.env.REPLICATE_API_TOKEN);
}

type Aspect = 'square' | 'story' | 'landscape' | 'portrait';
const FAL_SIZE: Record<Aspect, string> = { square: 'square_hd', story: 'portrait_16_9', landscape: 'landscape_16_9', portrait: 'portrait_4_3' };
const REPLICATE_AR: Record<Aspect, string> = { square: '1:1', story: '9:16', landscape: '16:9', portrait: '3:4' };

// Keep generations brand-safe + marketing-appropriate for mortgage/real-estate.
function decorate(prompt: string): string {
  return `${prompt.trim()}. Professional, clean, modern marketing photography style, high quality, no text, no watermarks.`;
}

async function viaFal(prompt: string, aspect: Aspect): Promise<string> {
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: decorate(prompt), image_size: FAL_SIZE[aspect], num_images: 1, enable_safety_checker: true }),
  });
  if (!res.ok) throw new Error(`fal.ai error ${res.status}`);
  const j = await res.json();
  const url = j?.images?.[0]?.url;
  if (!url) throw new Error('fal.ai returned no image');
  return url as string;
}

async function viaReplicate(prompt: string, aspect: Aspect): Promise<string> {
  // Replicate's sync-ish endpoint with Prefer: wait.
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input: { prompt: decorate(prompt), aspect_ratio: REPLICATE_AR[aspect], output_format: 'webp', num_outputs: 1 } }),
  });
  if (!res.ok) throw new Error(`Replicate error ${res.status}`);
  const j = await res.json();
  const out = j?.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (!url) throw new Error('Replicate returned no image');
  return url as string;
}

export async function generateImage(prompt: string, aspect: Aspect = 'square'): Promise<string> {
  if (process.env.FAL_KEY) return viaFal(prompt, aspect);
  if (process.env.REPLICATE_API_TOKEN) return viaReplicate(prompt, aspect);
  throw new ImageGenNotConfigured();
}
