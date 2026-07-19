// ---------------------------------------------------------------------------
// Form defaults.
//
// Set the values you use most often here — they pre-fill the form on load and
// can still be edited in the UI before requesting a token.
// ---------------------------------------------------------------------------

// Default OAuth2 token endpoint. Replace with the endpoint you use most.
// Example (Azure AD): https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token
export const DEFAULT_TOKEN_URL =
  'https://login.microsoftonline.com/b618d97c-e68e-4843-8ea4-774f6b98a567/oauth2/v2.0/token';

// Default grant type. For the client credentials flow this is always
// "client_credentials"; kept here so it's easy to change if ever needed.
export const DEFAULT_GRANT_TYPE = 'client_credentials';

// Default scope(s). Space-delimited if more than one. Leave '' for none.
export const DEFAULT_SCOPE = '';

// How client credentials are sent to the token endpoint:
//   'body'  -> client_id & client_secret in the form body (client_secret_post)
//   'basic' -> HTTP Basic Authorization header      (client_secret_basic)
export const DEFAULT_AUTH_STYLE = 'body';

// Clear credentials and token results after five minutes. Set to 0 to disable.
export const AUTO_CLEAR_SENSITIVE_DATA_MS = 5 * 60 * 1000;
