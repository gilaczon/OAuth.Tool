import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { handleApiRequest } from './server/api.js';

const LOCAL_PROFILES = fileURLToPath(new URL('./server/profiles.local.json', import.meta.url));

// Dev-only configuration. Locally there is no Easy Auth front end to inject the
// principal headers and no App Service settings to hold the profiles, so both
// are faked here. This runs from configureServer, which never executes during
// `vite build`, so none of it can leak into a production bundle or deployment.
//
// server/profiles.local.json (gitignored via the existing *.local rule):
//   { "profiles": [ ...same shape as OAUTH_PROFILES... ],
//     "secrets":  { "OAUTH_SECRET_EXAMPLE": "dev-secret" } }
function applyDevEnvironment() {
  process.env.REQUIRE_AUTH ??= 'false';

  if (process.env.OAUTH_PROFILES || !existsSync(LOCAL_PROFILES)) return;

  const { profiles = [], secrets = {} } = JSON.parse(readFileSync(LOCAL_PROFILES, 'utf8'));
  process.env.OAUTH_PROFILES = JSON.stringify(profiles);
  for (const [name, value] of Object.entries(secrets)) {
    process.env[name] ??= value;
  }
}

// Dev-server middleware exposing the same /api endpoints as the standalone
// production server, so the browser never makes a cross-origin call to the token
// endpoint. Both delegate to server/api.js to keep the behaviour identical.
function tokenProxyPlugin() {
  return {
    name: 'oauth-token-proxy',
    configureServer(server) {
      applyDevEnvironment();

      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        handleApiRequest(req, res, pathname)
          .then((handled) => {
            if (!handled) next();
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), tokenProxyPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
