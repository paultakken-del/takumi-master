async function hmacSHA256(secret, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestGet(context) {
  const { env } = context;

  const apiKey    = env.BITVAVO_API_KEY;
  const apiSecret = env.BITVAVO_API_KEY_SECRET;

  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({
      error: 'BITVAVO_API_KEY en/of BITVAVO_API_KEY_SECRET niet geconfigureerd',
      hasKey: !!apiKey,
      hasSecret: !!apiSecret,
      hint: 'Voeg toe via Cloudflare Pages → Settings → Variables and Secrets → redeploy'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const timestamp = Date.now();
    const path = '/balance';
    const sig = await hmacSHA256(apiSecret, `${timestamp}GET/v2${path}`);

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
      return new Response(JSON.stringify({ 
        error: `Bitvavo API ${upstream.status}: ${err}`,
        hint: 'Controleer of de API key de juiste permissies heeft (View balance)'
      }), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
    }

    const balances = await upstream.json();
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
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
