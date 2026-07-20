const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

export function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function setApiResponseHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw httpError('Invalid Origin header', 403);
  }

  if (!req.headers.host || originHost.toLowerCase() !== req.headers.host.toLowerCase()) {
    throw httpError('Cross-origin token requests are not allowed', 403);
  }
}

export function assertJsonContentType(req) {
  const contentType = String(req.headers['content-type'] || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== 'application/json') {
    throw httpError('Content-Type must be application/json', 415);
  }
}

export function readJsonBody(req, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(bytes);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(httpError(`Request body exceeds ${maxBytes} bytes`, 413));
        return;
      }

      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(httpError('Request body must contain valid JSON', 400));
      }
    });

    req.on('error', reject);
  });
}
