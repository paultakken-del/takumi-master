/**
 * /api/claude — Cloudflare Pages Function
 * Proxies requests naar Anthropic API, server-side.
 * Supports SSE streaming via TransformStream.
 *
 * Environment variable vereist in Cloudflare Pages:
 *   ANTHROPIC_API_KEY = sk-ant-...
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY niet geconfigureerd in Cloudflare Pages environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ongeldige JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isStreaming = body?.stream === true;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (isStreaming) {
    // Stream de SSE response direct door naar de browser
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // Non-streaming: geef JSON terug
  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
