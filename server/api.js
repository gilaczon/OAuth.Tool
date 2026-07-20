// Shared /api routing for both entrypoints.
//
// The standalone production server (server/index.js) and the Vite dev middleware
// (vite.config.js) previously carried near-identical copies of the /api/token
// handler. They both delegate here instead, so the request-validation and
// error-shaping rules cannot drift between development and production.

import { handleTokenRequest } from './tokenHandler.js';
import { listProfiles, resolveTokenRequest } from './profiles.js';
import { assertAuthenticated } from './auth.js';
import {
  assertJsonContentType,
  assertSameOrigin,
  readJsonBody,
  setApiResponseHeaders,
} from './requestUtils.js';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function getProfiles(req, res) {
  assertSameOrigin(req);
  assertAuthenticated(req);
  sendJson(res, 200, { profiles: listProfiles() });
}

async function postToken(req, res) {
  assertSameOrigin(req);
  assertJsonContentType(req);
  const parsed = await readJsonBody(req);

  // Only the saved-profile path requires a principal. Manual credential entry
  // stays open, so if the Easy Auth gate is ever removed the tool degrades to
  // exactly what it was before profiles existed rather than handing out the
  // stored secrets.
  if (parsed?.profileId) assertAuthenticated(req);

  sendJson(res, 200, await handleTokenRequest(resolveTokenRequest(parsed)));
}

const ROUTES = {
  '/api/profiles': { GET: getProfiles },
  '/api/token': { POST: postToken },
};

/**
 * Handle an /api request.
 *
 * @returns {Promise<boolean>} true if the request was handled (and the response
 *   ended), false if the caller should fall through to its own handling.
 */
export async function handleApiRequest(req, res, pathname) {
  const route = ROUTES[pathname];
  if (!route) return false;

  setApiResponseHeaders(res);

  const handler = route[req.method];
  if (!handler) {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return true;
  }

  try {
    await handler(req, res);
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      error: 'proxy_error',
      message: String(err?.message || err),
    });
  }

  return true;
}
