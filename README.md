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
- Both share one handler: `server/tokenHandler.js`.

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
export const DEFAULT_TOKEN_URL = 'https://issuer.example.com/oauth2/token';
export const DEFAULT_GRANT_TYPE = 'client_credentials';
export const DEFAULT_SCOPE = 'api.read api.write';
export const DEFAULT_AUTH_STYLE = 'body'; // or 'basic'
```

## Features

- Client credentials flow with `client_secret_post` **or** `client_secret_basic`
  (toggle in the form — switch if you get `invalid_client`).
- Token panel: `access_token` (copyable), `token_type`, `expires_in` with a live
  active/expired badge, scopes as chips, refresh/id tokens, and any extra fields.
- Decoded panel: JWT header + every payload claim, with human-readable
  descriptions for registered claims and formatted timestamps (`exp`, `iat`,
  `nbf`) plus relative time. Opaque (non-JWT) tokens are detected and explained.
- Auto light/dark theme (follows the OS) with a manual Auto/Light/Dark toggle.
- Client secret is never persisted; the client ID is remembered only if you opt
  in.

## Notes

- The decoder does **not** verify the token signature — this is an inspection
  tool, not a validator.
