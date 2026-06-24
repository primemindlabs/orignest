/**
 * Phase 146 — GET /api/widget/[key]/loader : the embeddable loader script.
 * The LO drops one <script> tag on their site; this injects a floating chat button
 * and an iframe pointing at the hosted widget page (same origin as the iframe, so the
 * chat APIs are called without CORS).
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.ashleyiq.com').replace(/\/$/, '');
  const key = params.key.replace(/[^a-zA-Z0-9_-]/g, '');
  const src = `${appUrl}/chat/${key}`;

  const js = `(function(){
  if (window.__ashleyWidgetLoaded) return; window.__ashleyWidgetLoaded = true;
  var SRC = ${JSON.stringify(src)};
  var open = false;
  var btn = document.createElement('button');
  btn.setAttribute('aria-label','Chat with us');
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:#1a1a1a;color:#fff;font-size:24px;box-shadow:0 6px 24px rgba(0,0,0,.25);z-index:2147483646;display:flex;align-items:center;justify-content:center;';
  btn.innerHTML = '\\uD83D\\uDCAC';
  var frame = document.createElement('iframe');
  frame.title = 'Chat';
  frame.src = SRC;
  frame.style.cssText = 'position:fixed;bottom:88px;right:20px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);border:none;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.3);z-index:2147483646;display:none;background:#fff;';
  function toggle(){ open = !open; frame.style.display = open ? 'block' : 'none'; btn.innerHTML = open ? '\\u2715' : '\\uD83D\\uDCAC'; }
  btn.addEventListener('click', toggle);
  function mount(){ document.body.appendChild(frame); document.body.appendChild(btn); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
