let jose, keys;
async function authenticate(request) {
  const tenant = process.env.DASHBOARD_TENANT_ID;
  const audience = process.env.DASHBOARD_CLIENT_ID;
  if (!tenant || !audience) throw Object.assign(new Error('Dashboard sign-in is not configured.'), { status: 503 });
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Sign in with your SLSSA Microsoft account.'), { status: 401 });
  jose ||= await import('jose');
  keys ||= jose.createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
  try {
    const { payload } = await jose.jwtVerify(header.slice(7), keys, { issuer: `https://login.microsoftonline.com/${tenant}/v2.0`, audience, algorithms: ['RS256'] });
    if (payload.tid !== tenant || !payload.oid || !(payload.scp || '').split(' ').includes('Dashboard.Access')) throw new Error('Missing access scope');
    return { id: payload.oid, name: payload.name || payload.preferred_username || payload.oid };
  } catch { throw Object.assign(new Error('Your SLSSA sign-in has expired or is not authorised.'), { status: 401 }); }
}
module.exports = { authenticate };
