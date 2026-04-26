const ADMIN_EMAIL = 'paul.takken@gmail.com';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const cookie = request.headers.get('Cookie') || '';
  const token = cookie.match(/gsession=([^;]+)/)?.[1] || url.searchParams.get('t');

  if (!token) return unauthorized();

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.email !== ADMIN_EMAIL) return unauthorized();
    if (payload.exp < Math.floor(Date.now()/1000)) return unauthorized();
  } catch { return unauthorized(); }

  const list = await env.TAKUMI_USERS.list();
  const users = await Promise.all(list.keys.map(async k => {
    const val = await env.TAKUMI_USERS.get(k.name);
    return val ? { id: k.name, ...JSON.parse(val) } : null;
  }));

  const valid = users.filter(Boolean).sort((a,b) => b.lastSeen - a.lastSeen);
  const fmt = ts => new Date(ts*1000).toLocaleString('nl-NL', {timeZone:'Europe/Amsterdam'});

  return new Response(`<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Takumi — Gebruikers</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f6f2eb;color:#1a1815;padding:24px;max-width:600px;margin:0 auto}
h1{font-size:22px;font-weight:600;margin-bottom:4px}
.sub{font-size:13px;color:#7a7060;margin-bottom:28px}
.card{background:#fff;border-radius:12px;border:1px solid rgba(28,24,21,.09);padding:16px 20px;margin-bottom:12px}
.name{font-size:15px;font-weight:600;margin-bottom:3px}
.email{font-size:13px;color:#c4532a;margin-bottom:10px}
.meta{font-size:12px;color:#7a7060;display:flex;flex-direction:column;gap:3px}
.badge{display:inline-block;background:rgba(196,83,42,.1);color:#c4532a;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;margin-left:8px}
.empty{text-align:center;padding:48px;color:#7a7060}
</style></head><body>
<h1>匠 Gebruikers</h1>
<p class="sub">${valid.length} gebruiker${valid.length!==1?'s':''} · bijgewerkt zojuist</p>
${valid.length===0?'<div class="empty">Nog niemand ingelogd.</div>':
  valid.map(u=>`<div class="card">
  <div class="name">${u.name}<span class="badge">${u.loginCount}×</span></div>
  <div class="email">${u.email}</div>
  <div class="meta">
    <span>Eerste login: ${fmt(u.firstSeen)}</span>
    <span>Laatste login: ${fmt(u.lastSeen)}</span>
  </div>
</div>`).join('')}
</body></html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

function unauthorized() {
  return new Response(`<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:60px">
<h2>Geen toegang</h2><p style="margin:12px 0;color:#888">Log in via de app en ga dan naar /admin/users</p>
<a href="https://app.takumi-master.com" style="background:#c4532a;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px">Naar app →</a>
</body></html>`, { status: 401, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}
