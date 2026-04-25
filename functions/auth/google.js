// /auth/google — stuurt gebruiker naar Google OAuth
export async function onRequest(context) {
  const { env } = context;
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response('GOOGLE_CLIENT_ID niet ingesteld', { status: 500 });
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  'https://app.takumi-master.com/auth/callback',
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'online',
    prompt:        'select_account',
  });

  return Response.redirect(
    'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
    302
  );
}
