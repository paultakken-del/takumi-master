export async function onRequest({ env }) {
  const id = env.GOOGLE_CLIENT_ID;
  if (!id) return new Response('GOOGLE_CLIENT_ID niet ingesteld', { status: 500 });
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: 'https://app.takumi-master.com/auth/callback',
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + p, 302);
}
