# OAuth2 Client Credentials Tool

A small Vue 3 tool for exercising the **OAuth2 client credentials flow**. Enter
a client ID, client secret and scope, press **Request Token**, and it shows the
token, its properties (type, expiry with a live countdown, scope, …) and the
fully **decoded JWT claims**.

The OAuth2 token URL and `client_credentials` grant type are pre-filled and
editable.

## Why a proxy?

Token endpoints usually don't send CORS headers, so a browser can't call them
directly, and putting a client secret in a cross-origin browser request is bad
practice. This app makes the token request **server-side** through a tiny proxy
(`POST /api/token`), so requests work regardless of the endpoint's CORS policy
and the secret never leaves your own machine.

- In development the proxy is a Vite dev-server middleware (see
  `vite.config.js`).
- In production it's a zero-dependency Node server (`server/index.js`).
- Both delegate to the same routing and validation in `server/api.js`, which
  calls the token exchange in `server/tokenHandler.js`.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

### Production build

```bash
npm run build   # outputs to dist/
npm start       # serves dist/ + the /api/token proxy on http://localhost:4173
```

## Setting form defaults

Edit `src/config.js` to pre-fill the fields you use most often:

```js
export const DEFAULT_TOKEN_URL =
  'https://login.microsoftonline.com/b618d97c-e68e-4843-8ea4-774f6b98a567/oauth2/v2.0/token';
export const DEFAULT_GRANT_TYPE = 'client_credentials';
export const DEFAULT_SCOPE = 'api.read api.write';
export const DEFAULT_AUTH_STYLE = 'body'; // or 'basic'
export const AUTO_CLEAR_SENSITIVE_DATA_MS = 5 * 60 * 1000;
```

When the endpoint is Microsoft identity platform v2, the form recommends a
single application scope ending in `/.default`, for example
`https://graph.microsoft.com/.default` or `api://<application-id>/.default`.

## Saved profiles

Frequently-used credentials can be offered as a dropdown instead of being retyped.
Profiles are configured entirely through environment variables, so **no secret ever
enters this repository or the browser bundle**.

`OAUTH_PROFILES` holds the metadata as a JSON array — no secrets:

```json
[
  {
    "id": "example-uat",
    "name": "Example UAT",
    "tokenUrl": "https://issuer.example.com/oauth2/token",
    "clientId": "your-client-id",
    "scope": "api.read",
    "authStyle": "body",
    "secretSetting": "OAUTH_SECRET_EXAMPLE_UAT"
  }
]
```

Each `secretSetting` names a **separate** environment variable holding the actual
secret (`OAUTH_SECRET_EXAMPLE_UAT=…`). Keeping them apart means the metadata is safe
to log and to return to the client, rotating one secret touches one setting, and each
can be swapped for an `@Microsoft.KeyVault(SecretUri=…)` reference without code changes.

The browser only ever receives the metadata. Selecting a profile sends a `profileId`;
the server attaches the secret. `tokenUrl`, `clientId` and `clientSecret` always come
from the profile and cannot be overridden by the request — otherwise the endpoint could
be used to send a stored secret to an attacker-chosen destination. Only `scope`,
`authStyle` and `extraParams` stay caller-controlled.

**Profiles require an authenticated caller** (see below). Manual credential entry does
not, so if the auth gate is ever removed the tool degrades to plain manual use rather
than handing out stored secrets.

For local development, create `server/profiles.local.json` (already gitignored by the
`*.local` rule) and `npm run dev` will load it and relax the auth requirement:

```json
{
  "profiles": [{ "id": "example-uat", "...": "same shape as OAUTH_PROFILES" }],
  "secrets": { "OAUTH_SECRET_EXAMPLE_UAT": "dev-secret" }
}
```

## Testing

```bash
npm test          # Node unit tests
npm run test:e2e  # Playwright end-to-end tests in Chromium
```

Run `npx playwright install chromium` once if Chromium has not been installed
for Playwright on the machine. Use `npm run test:e2e:ui` for Playwright's
interactive test runner.

## Features

- Client credentials flow with `client_secret_post` **or** `client_secret_basic`
  (toggle in the form — switch if you get `invalid_client`).
- Token panel: `access_token` (copyable), `token_type`, `expires_in` with a live
  active/expired badge, scopes as chips, refresh/id tokens, and any extra fields.
- Decoded panel: JWT header + every payload claim, with human-readable
  descriptions for registered claims and formatted timestamps (`exp`, `iat`,
  `nbf`) plus relative time. Opaque (non-JWT) tokens are detected and explained.
- Auto light/dark theme (follows the OS) with a manual Auto/Light/Dark toggle.
- Optional saved profiles: pick frequently-used credentials from a dropdown while
  the secrets stay server-side.
- Typed client credentials are never persisted; a saved profile is remembered by id
  only.
- Access, refresh and ID tokens are masked until explicitly revealed.
- Credentials and token results can be cleared immediately and auto-clear after
  five minutes by default.

## Security defaults

The production server listens on `127.0.0.1` by default. Token endpoints must
use HTTPS, resolve only to public network addresses, and must not redirect.
Requests time out after 15 seconds, request bodies are limited to 64 KiB, and
token responses are limited to 2 MiB.

For controlled development environments, these restrictions can be adjusted
with environment variables:

- `HOST` and `PORT` select the listening interface and port.
- `ALLOW_PRIVATE_TOKEN_URLS=true` allows private or loopback token endpoints.
- `ALLOW_INSECURE_TOKEN_URLS=true` allows plain HTTP token endpoints.
- `TOKEN_REQUEST_TIMEOUT_MS` changes the outbound timeout.
- `MAX_TOKEN_RESPONSE_BYTES` changes the maximum token response size.

### Authentication

Do not expose this utility publicly **unless it is behind an authentication gate** —
an unauthenticated deployment that has saved profiles configured is a public
token-vending machine.

The deployed instance sits behind Azure App Service Authentication ("Easy Auth")
restricted to a single tenant. The server additionally requires the
`X-MS-CLIENT-PRINCIPAL-ID` header that Easy Auth injects before it will resolve any
saved profile. That header is only trustworthy while Easy Auth is enabled — App
Service strips inbound copies of it — so the check exists to *fail closed* if the gate
is ever turned off, not as the gate itself.

- `REQUIRE_AUTH=false` disables the principal check. **Local development only.**
- `ALLOWED_PRINCIPALS` optionally restricts saved-profile use to a comma-separated
  list of user names, on top of whatever the identity provider already enforces.

If private or insecure endpoints are enabled, keep the server bound to localhost or
another trusted interface.

## Notes

- The decoder does **not** verify the token signature — this is an inspection
  tool, not a validator.
