/**
 * Cloudflare Pages Middleware
 * www.takumi-master.com  → landing.html
 * app.takumi-master.com  → index.html (default, pass through)
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const host = url.hostname;

  // www subdomain → serve landing page transparently
  if (host === 'www.takumi-master.com' || host === 'takumi-master.com') {
    // Only intercept root path — let /landing.html, /api/*, etc. pass through
    if (url.pathname === '/' || url.pathname === '') {
      const landingUrl = new URL('/landing.html', url.origin);
      const landingReq = new Request(landingUrl.toString(), request);
      return fetch(landingReq);
    }
  }

  // All other requests (app.takumi-master.com, or non-root paths) → normal
  return next();
}
