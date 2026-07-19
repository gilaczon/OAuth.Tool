import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  assertJsonContentType,
  assertSameOrigin,
  readJsonBody,
} from './requestUtils.js';

function request(body, headers = {}) {
  const req = Readable.from([body]);
  req.headers = headers;
  return req;
}

test('requires JSON request bodies', () => {
  assert.throws(
    () => assertJsonContentType(request('', { 'content-type': 'text/plain' })),
    (error) => error.statusCode === 415,
  );
});

test('allows same-origin requests and rejects cross-origin requests', () => {
  assert.doesNotThrow(() =>
    assertSameOrigin(request('', { host: 'localhost:4173', origin: 'http://localhost:4173' })),
  );
  assert.throws(
    () =>
      assertSameOrigin(
        request('', { host: 'localhost:4173', origin: 'https://attacker.example' }),
      ),
    (error) => error.statusCode === 403,
  );
});

test('parses JSON within the body limit', async () => {
  const parsed = await readJsonBody(request('{"ok":true}'), 64);
  assert.deepEqual(parsed, { ok: true });
});

test('rejects invalid or oversized JSON bodies', async () => {
  await assert.rejects(readJsonBody(request('{'), 64), (error) => error.statusCode === 400);
  await assert.rejects(
    readJsonBody(request('{"value":"too large"}'), 8),
    (error) => error.statusCode === 413,
  );
});
