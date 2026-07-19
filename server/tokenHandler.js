// Shared server-side token-request handler.
//
// This runs on the server (either the Vite dev middleware or the standalone
// production server) so the actual OAuth2 token exchange is a server-to-server
// request. That avoids browser CORS restrictions and keeps the client secret
// out of any cross-origin browser request.

/**
 * Perform an OAuth2 token request against the given token endpoint.
 *
 * @param {object} body
 * @param {string} body.tokenUrl      - OAuth2 token endpoint URL.
 * @param {string} body.clientId      - Client identifier.
 * @param {string} body.clientSecret  - Client secret.
 * @param {string} [body.scope]       - Optional space-delimited scopes.
 * @param {string} [body.grantType]   - Grant type (default: client_credentials).
 * @param {string} [body.authStyle]   - "basic" (Authorization header) or
 *                                       "body" (client_id/secret in form body).
 * @param {object} [body.extraParams] - Optional extra form params { key: value }.
 * @returns {Promise<{status:number, ok:boolean, data:any, requestedAt:string}>}
 */
export async function handleTokenRequest(body) {
  const {
    tokenUrl,
    clientId,
    clientSecret,
    scope,
    grantType = 'client_credentials',
    authStyle = 'body',
    extraParams = {},
  } = body || {};

  if (!tokenUrl) {
    const err = new Error('tokenUrl is required');
    err.statusCode = 400;
    throw err;
  }
  if (!/^https?:\/\//i.test(tokenUrl)) {
    const err = new Error('tokenUrl must be an absolute http(s) URL');
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams();
  params.set('grant_type', grantType);
  if (scope) params.set('scope', scope);

  for (const [key, value] of Object.entries(extraParams)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (authStyle === 'basic') {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  } else {
    if (clientId) params.set('client_id', clientId);
    if (clientSecret) params.set('client_secret', clientSecret);
  }

  const requestedAt = new Date().toISOString();

  let resp;
  try {
    resp = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: params.toString(),
    });
  } catch (err) {
    const wrapped = new Error(`Failed to reach token endpoint: ${err.message}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }

  const text = await resp.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Endpoint returned something that isn't JSON (e.g. an HTML error page).
    data = { raw: text };
  }

  return {
    status: resp.status,
    ok: resp.ok,
    data,
    requestedAt,
  };
}
