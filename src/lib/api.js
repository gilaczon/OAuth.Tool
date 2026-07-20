// Calling the /api endpoints behind Azure App Service Authentication.
//
// Easy Auth answers an unauthenticated request with a 302 to the Entra sign-in
// page rather than a 401. A default fetch() follows that redirect cross-origin
// and fails with an opaque CORS error, which surfaces as a baffling JSON parse
// failure. `redirect: 'manual'` turns it into a recognisable 'opaqueredirect'
// response we can report properly.

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session expired. Reload the page to sign in again.');
    this.name = 'SessionExpiredError';
  }
}

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'manual' });

  // 'opaqueredirect' is the Easy Auth sign-in redirect; 401 is our own
  // server-side principal check failing closed.
  if (response.type === 'opaqueredirect' || response.status === 401) {
    throw new SessionExpiredError();
  }

  return response;
}
