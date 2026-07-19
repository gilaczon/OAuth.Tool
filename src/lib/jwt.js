// Small, dependency-free JWT helpers used to decode the access token and
// present its claims. Decoding only — signatures are NOT verified (this is an
// inspection tool, not a validator).

/** Base64url-decode a string into UTF-8 text. */
function base64UrlDecode(input) {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const binary = atob(s);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decode a JWT into its header and payload.
 * @returns {{header:object, payload:object, signature:string}|null}
 *          null when the value is not a well-formed JWT (e.g. an opaque token).
 */
export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload, signature: parts[2] };
  } catch {
    return null;
  }
}

// Registered claim names -> human-friendly descriptions (RFC 7519 + common).
export const CLAIM_DESCRIPTIONS = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expiration Time',
  nbf: 'Not Before',
  iat: 'Issued At',
  jti: 'JWT ID',
  azp: 'Authorized Party',
  scope: 'Scope',
  scp: 'Scope',
  roles: 'Roles',
  client_id: 'Client ID',
  appid: 'Application ID',
  tid: 'Tenant ID',
  typ: 'Type',
  alg: 'Algorithm',
  kid: 'Key ID',
};

// Claims whose numeric value is a Unix timestamp (seconds).
const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time']);

export function isTimeClaim(key) {
  return TIME_CLAIMS.has(key);
}

/** Format a Unix-seconds timestamp as a readable local + UTC string. */
export function formatTimestamp(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  const d = new Date(seconds * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/** Human relative time, e.g. "in 59 minutes" / "3 minutes ago". */
export function relativeTime(seconds, nowMs = Date.now()) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  const diffSec = Math.round((seconds * 1000 - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [name, size] of units) {
    if (abs >= size || name === 'second') {
      const value = Math.round(diffSec / size);
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      return rtf.format(value, name);
    }
  }
  return null;
}
