// Saved credential profiles.
//
// Profiles let the UI offer a dropdown of frequently-used client credentials
// instead of retyping them. They are configured entirely through environment
// (App Service application settings) so no secret ever reaches the repository
// or the browser bundle:
//
//   OAUTH_PROFILES        JSON array of profile metadata — no secrets
//   OAUTH_SECRET_<NAME>   one setting per profile, holding the actual secret
//
// Keeping the secrets in their own settings means the metadata blob is safe to
// return to the client and safe to log, rotation touches a single setting, and
// each secret can later be swapped for an @Microsoft.KeyVault(...) reference
// without any code change.

import { httpError } from './requestUtils.js';

const PROFILES_ENV = 'OAUTH_PROFILES';
const REQUIRED_KEYS = ['id', 'name', 'tokenUrl', 'clientId', 'secretSetting'];

function validateProfile(profile, index) {
  const where = `${PROFILES_ENV}[${index}]`;

  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw httpError(`${where} must be an object`, 500);
  }

  for (const key of REQUIRED_KEYS) {
    if (typeof profile[key] !== 'string' || !profile[key].trim()) {
      throw httpError(`${where}.${key} is required`, 500);
    }
  }

  const authStyle = profile.authStyle ?? 'body';
  if (!['body', 'basic'].includes(authStyle)) {
    throw httpError(`${where}.authStyle must be "body" or "basic"`, 500);
  }

  return {
    id: profile.id.trim(),
    name: profile.name.trim(),
    tokenUrl: profile.tokenUrl.trim(),
    clientId: profile.clientId.trim(),
    scope: typeof profile.scope === 'string' ? profile.scope : '',
    authStyle,
    secretSetting: profile.secretSetting.trim(),
  };
}

/**
 * Parse and validate OAUTH_PROFILES. Returns [] when unconfigured.
 *
 * Malformed configuration throws rather than degrading to an empty list, so a
 * typo surfaces as a visible error instead of a silently empty dropdown.
 */
export function loadProfiles(env = process.env) {
  const raw = env[PROFILES_ENV];
  if (!raw || !raw.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw httpError(`${PROFILES_ENV} is not valid JSON`, 500);
  }

  if (!Array.isArray(parsed)) {
    throw httpError(`${PROFILES_ENV} must be a JSON array`, 500);
  }

  const profiles = parsed.map(validateProfile);
  const ids = new Set();
  for (const { id } of profiles) {
    if (ids.has(id)) throw httpError(`${PROFILES_ENV} has duplicate id "${id}"`, 500);
    ids.add(id);
  }

  return profiles;
}

/**
 * Profile metadata safe to send to the browser.
 *
 * clientId is included deliberately: it is not a secret (it travels in the token
 * request either way and shows up as the `appid` claim in the decoded token), and
 * surfacing it lets the user confirm which app they are about to use. The secret
 * — and even the name of the setting holding it — never leaves the server.
 */
export function listProfiles(env = process.env) {
  return loadProfiles(env).map(({ secretSetting, ...metadata }) => metadata);
}

/**
 * Expand a request body that references a saved profile into a full token
 * request. Bodies without `profileId` pass through untouched.
 *
 * tokenUrl, clientId and clientSecret always come from the profile and cannot be
 * overridden by the request. That is deliberate: if the caller could pair a
 * server-held secret with an arbitrary tokenUrl, the endpoint would become a way
 * to exfiltrate that secret to a chosen destination. Only scope, authStyle and
 * extraParams stay caller-controlled, so one saved app can still be exercised
 * against different scopes.
 */
export function resolveTokenRequest(body, env = process.env) {
  const profileId = body?.profileId;
  if (!profileId) return body;

  const profile = loadProfiles(env).find((candidate) => candidate.id === profileId);
  if (!profile) {
    throw httpError(`Unknown profile "${profileId}"`, 404);
  }

  const clientSecret = env[profile.secretSetting];
  if (!clientSecret) {
    throw httpError(
      `Profile "${profile.id}" references application setting ${profile.secretSetting}, which is not set`,
      500,
    );
  }

  const { profileId: _referenced, ...rest } = body;

  return {
    ...rest,
    tokenUrl: profile.tokenUrl,
    clientId: profile.clientId,
    clientSecret,
    scope: rest.scope ?? profile.scope,
    authStyle: rest.authStyle ?? profile.authStyle,
  };
}
