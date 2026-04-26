export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return Response.redirect('https://app.takumi-master.com?auth_error=1', 302);

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
  if (!tokens.id_token) return Response.redirect('https://app.takumi-master.com?auth_error=2', 302);

  const payload = JSON.parse(atob(tokens.id_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  const now = Math.floor(Date.now() / 1000);

  // Sla gebruiker op in KV
  if (env.TAKUMI_USERS) {
    const userRecord = JSON.stringify({
      email:     payload.email,
      name:      payload.name || payload.email,
      picture:   payload.picture || '',
      firstSeen: now,
      lastSeen:  now,
    });

    // Check of gebruiker al bestaat (bewaar firstSeen)
    const existing = await env.TAKUMI_USERS.get(payload.sub);
    if (existing) {
      const prev = JSON.parse(existing);
      await env.TAKUMI_USERS.put(payload.sub, JSON.stringify({
        ...prev,
        lastSeen: now,
        loginCount: (prev.loginCount || 1) + 1,
      }));
    } else {
      await env.TAKUMI_USERS.put(payload.sub, JSON.stringify({
        email:      payload.email,
        name:       payload.name || payload.email,
        picture:    payload.picture || '',
        firstSeen:  now,
        lastSeen:   now,
        loginCount: 1,
      }));
    }
  }

  // Maak JWT sessie
  const sess = { sub: payload.sub, email: payload.email, name: payload.name||payload.email, picture: payload.picture||'', iat: now, exp: now+604800, loginAt: now };
  const h = btoa(JSON.stringify({alg:'HS256',typ:'JWT'})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const b = btoa(JSON.stringify(sess)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET||'fallback'), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(h+'.'+b));
  const s = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

  return Response.redirect('https://app.takumi-master.com?gsession='+h+'.'+b+'.'+s, 302);
}
