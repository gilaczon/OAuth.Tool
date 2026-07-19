// Shared server-side token-request handler.
//
// This runs on the server (either the Vite dev middleware or the standalone
// production server) so the actual OAuth2 token exchange is a server-to-server
// request. That avoids browser CORS restrictions and keeps the client secret
// out of any cross-origin browser request.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function requestError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isBlockedIpv4(address) {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(address) {
  const normalized = address.toLowerCase().split('%', 1)[0];

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }

  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:') ||
    /^2001:0{0,4}:/.test(normalized) ||
    normalized.startsWith('2002:') ||
    normalized.startsWith('64:ff9b:')
  ) {
    return true;
  }

  const firstHextet = Number.parseInt(normalized.split(':', 1)[0], 16);
  return !Number.isFinite(firstHextet) || firstHextet < 0x2000 || firstHextet > 0x3fff;
}

export function isBlockedAddress(address) {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true;
}

export async function validateTokenUrl(
  value,
  {
    allowPrivate = process.env.ALLOW_PRIVATE_TOKEN_URLS === 'true',
    allowInsecure = process.env.ALLOW_INSECURE_TOKEN_URLS === 'true',
    lookupFn = lookup,
  } = {},
) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw requestError('tokenUrl must be an absolute URL');
  }

  if (url.username || url.password) {
    throw requestError('tokenUrl must not contain embedded credentials');
  }
  if (url.protocol !== 'https:' && !(allowInsecure && url.protocol === 'http:')) {
    throw requestError('tokenUrl must use HTTPS');
  }
  if (allowPrivate) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookupFn(hostname, { all: true, verbatim: true }).catch(() => {
        throw requestError('Unable to resolve token endpoint hostname', 502);
      });

  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw requestError('Token endpoints on private or reserved networks are blocked');
  }

  return url;
}

async function readLimitedText(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw requestError(`Token endpoint response exceeds ${maxBytes} bytes`, 502);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw requestError(`Token endpoint response exceeds ${maxBytes} bytes`, 502);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

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

  if (!tokenUrl) throw requestError('tokenUrl is required');
  if (!clientId) throw requestError('clientId is required');
  if (!clientSecret) throw requestError('clientSecret is required');
  if (!['body', 'basic'].includes(authStyle)) {
    throw requestError('authStyle must be "body" or "basic"');
  }
  if (!extraParams || typeof extraParams !== 'object' || Array.isArray(extraParams)) {
    throw requestError('extraParams must be an object');
  }

  const validatedUrl = await validateTokenUrl(tokenUrl);

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
  let text;
  const timeoutMs = parsePositiveInteger(process.env.TOKEN_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const maxResponseBytes = parsePositiveInteger(
    process.env.MAX_TOKEN_RESPONSE_BYTES,
    DEFAULT_MAX_RESPONSE_BYTES,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    resp = await fetch(validatedUrl, {
      method: 'POST',
      headers,
      body: params.toString(),
      redirect: 'manual',
      signal: controller.signal,
    });

    if (resp.status >= 300 && resp.status < 400) {
      throw requestError('Token endpoint redirects are not allowed', 502);
    }

    text = await readLimitedText(resp, maxResponseBytes);
  } catch (err) {
    if (controller.signal.aborted) {
      throw requestError(`Token endpoint timed out after ${timeoutMs}ms`, 504);
    }
    if (err.statusCode) throw err;
    throw requestError(`Failed to reach token endpoint: ${err.message}`, 502);
  } finally {
    clearTimeout(timeout);
  }
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
