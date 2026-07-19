// Standalone production server: serves the built SPA from dist/ and exposes the
// POST /api/token proxy endpoint. Zero external dependencies (Node 22+).
//
//   npm run build && npm start
//
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTokenRequest } from './tokenHandler.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 4173;

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  // Prevent path traversal, then map "/" to index.html.
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  if (rel === '/' || rel === '') rel = '/index.html';
  let filePath = join(distDir, rel);

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
  if (req.url && req.url.startsWith('/api/token')) {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    try {
      const raw = await readBody(req);
      const parsed = raw ? JSON.parse(raw) : {};
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

server.listen(PORT, () => {
  console.log(`OAuth2 tool server running at http://localhost:${PORT}`);
});
