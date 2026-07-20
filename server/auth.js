// Caller identity, as established by Azure App Service Authentication ("Easy Auth").
//
// Easy Auth terminates the sign-in at the App Service front end and forwards the
// resolved principal to the container as X-MS-CLIENT-PRINCIPAL-* headers. The
// front end strips any inbound copies of those headers *while Easy Auth is
// enabled*, which is what makes them trustworthy here.
//
// This check is defence in depth rather than the primary gate: the gate is Easy
// Auth itself. It exists so that turning Easy Auth off fails closed — saved
// profile secrets stop being reachable — instead of silently exposing them.

import { httpError } from './requestUtils.js';

const PRINCIPAL_ID_HEADER = 'x-ms-client-principal-id';
const PRINCIPAL_NAME_HEADER = 'x-ms-client-principal-name';

/**
 * Resolve the authenticated principal, or throw.
 *
 * Set REQUIRE_AUTH=false for local development, where no Easy Auth front end
 * exists to inject the headers. Never set it on the deployed app.
 *
 * @returns {{id: string, name: string}}
 */
export function assertAuthenticated(req, env = process.env) {
  if (env.REQUIRE_AUTH === 'false') {
    return { id: 'local-dev', name: 'local-dev' };
  }

  const id = req.headers?.[PRINCIPAL_ID_HEADER];
  if (!id) {
    throw httpError('Authentication required', 401);
  }

  const name = req.headers[PRINCIPAL_NAME_HEADER] || '';
  const allowed = (env.ALLOWED_PRINCIPALS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length && !allowed.includes(name.toLowerCase())) {
    throw httpError('This account is not allowed to use saved profiles', 403);
  }

  return { id, name };
}
