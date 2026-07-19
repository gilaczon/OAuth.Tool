// Standalone production server: serves the built SPA from dist/ and exposes the
// POST /api/token proxy endpoint. Zero external dependencies (Node 22+).
//
//   npm run build && npm start
//
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTokenRequest } from './tokenHandler.js';
import {
  assertJsonContentType,
  assertSameOrigin,
  readJsonBody,
  setApiResponseHeaders,
} from './requestUtils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  const distRoot = resolve(distDir);
  const relativePath = urlPath.replace(/^[/\\]+/, '') || 'index.html';
  let filePath = resolve(distRoot, relativePath);

  // URL paths are untrusted; never allow the resolved path to escape dist/.
  if (!filePath.startsWith(`${distRoot}${sep}`)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  // SPA fallback: unknown non-asset routes serve index.html.
  if (!existsSync(filePath)) {
    filePath = join(distDir, 'index.html');
  }

  try {
    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === '/api/token') {
    setApiResponseHeaders(res);
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
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
        JSON.stringify({ error: 'proxy_error', message: String(err?.message || err) }),
      );
    }
    return;
  }

  await serveStatic(req, res);
});

if (!existsSync(distDir)) {
  console.warn('[server] dist/ not found — run "npm run build" first.');
}

server.listen(PORT, HOST, () => {
  console.log(`OAuth2 tool server running at http://${HOST}:${PORT}`);
});
