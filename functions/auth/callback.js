// /auth/callback — ontvangt code van Google, maakt JWT, stuurt naar app
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return Response.redirect('https://app.takumi-master.com?auth_error=1', 302);
  }

  try {
    // 1. Wissel code in voor tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  'https://app.takumi-master.com/auth/callback',
        grant_type:    'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.id_token) {
      return Response.redirect('https://app.takumi-master.com?auth_error=2', 302);
    }

    // 2. Decodeer id_token (JWT, geen verificatie nodig — Google ondertekende het)
    const payload = JSON.parse(
      atob(tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );

    // 3. Maak eigen sessie-JWT
    const now = Math.floor(Date.now() / 1000);
    const sessionPayload = {
      sub:     payload.sub,
      email:   payload.email,
      name:    payload.name || payload.email,
      picture: payload.picture || '',
      iat:     now,
      exp:     now + 7 * 24 * 60 * 60, // 7 dagen
      loginAt: now,
    };

    // Simpele gesigneerde token (HMAC via WebCrypto)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const body = btoa(JSON.stringify(sessionPayload))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const secret = env.JWT_SECRET || 'fallback-secret';
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(header + '.' + body)
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const jwt = header + '.' + body + '.' + sigB64;

    // 4. Stuur naar app met sessie-token
    return Response.redirect(
      'https://app.takumi-master.com?gsession=' + jwt, 302
    );

  } catch (err) {
    return Response.redirect(
      'https://app.takumi-master.com?auth_error=3', 302
    );
  }
}
