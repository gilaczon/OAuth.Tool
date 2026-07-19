import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { handleTokenRequest } from './server/tokenHandler.js';
import {
  assertJsonContentType,
  assertSameOrigin,
  readJsonBody,
  setApiResponseHeaders,
} from './server/requestUtils.js';

// Dev-server middleware that exposes POST /api/token and performs the OAuth2
// token exchange server-side, so the browser never makes a cross-origin call to
// the token endpoint. Mirrors the standalone production server in server/index.js.
function tokenProxyPlugin() {
  return {
    name: 'oauth-token-proxy',
    configureServer(server) {
      server.middlewares.use('/api/token', (req, res) => {
        setApiResponseHeaders(res);
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }

        (async () => {
          try {
            assertSameOrigin(req);
            assertJsonContentType(req);
            const parsed = await readJsonBody(req);
            const result = await handleTokenRequest(parsed);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            res.statusCode = err.statusCode || 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'proxy_error',
                message: String(err?.message || err),
              }),
            );
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), tokenProxyPlugin()],
  server: {
    port: 5173,
  },
});
