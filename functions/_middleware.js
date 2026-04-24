/**
 * Cloudflare Pages Middleware
 * www.takumi-master.com  → landing.html
 * app.takumi-master.com  → index.html (default, pass through)
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const host = url.hostname;

  // www subdomain root → serve landing.html via ASSETS binding
  if (
    (host === 'www.takumi-master.com' || host === 'takumi-master.com') &&
    (url.pathname === '/' || url.pathname === '')
  ) {
    const assetUrl = new URL('/landing.html', url.origin);
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }

  // Everything else → normal Pages routing
  return next();
}

