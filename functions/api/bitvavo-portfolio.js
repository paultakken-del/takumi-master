/**
 * /api/bitvavo-portfolio — Cloudflare Pages Function
 * Haalt echte Bitvavo posities op via HMAC-signed REST API.
 *
 * Environment variables vereist in Cloudflare Pages:
 *   BITVAVO_API_KEY    = jouw Bitvavo API key
 *   BITVAVO_API_SECRET = jouw Bitvavo API secret
 */

async function hmacSHA256(secret, message) {
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestGet(context) {
  const { env } = context;

  const apiKey    = env.BITVAVO_API_KEY;
  const apiSecret = env.BITVAVO_API_SECRET;

  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({
      error: 'BITVAVO_API_KEY en BITVAVO_API_SECRET niet geconfigureerd. Voeg toe via Cloudflare Pages → Settings → Environment Variables.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const timestamp = Date.now();
    const path      = '/balance';
    const method    = 'GET';

    // Bitvavo HMAC signature: timestamp + method + /v2 + path
    const msg = `${timestamp}${method}/v2${path}`;
    const sig = await hmacSHA256(apiSecret, msg);

    const upstream = await fetch(`https://api.bitvavo.com/v2${path}`, {
      headers: {
        'Bitvavo-Access-Key':       apiKey,
        'Bitvavo-Access-Signature': sig,
        'Bitvavo-Access-Timestamp': String(timestamp),
        'Bitvavo-Access-Window':    '10000',
      },
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return new Response(JSON.stringify({ error: err }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const balances = await upstream.json();

    // Filter posities met saldo > 0
    const positions = balances
      .filter(b => parseFloat(b.available) + parseFloat(b.inOrder) > 0.000001)
      .map(b => ({
        symbol:    b.symbol,
        available: parseFloat(b.available),
        inOrder:   parseFloat(b.inOrder),
        total:     parseFloat(b.available) + parseFloat(b.inOrder),
      }));

    return new Response(JSON.stringify({ positions, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'max-age=60', // 60s cache op Cloudflare edge
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
