import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAuthenticated } from './auth.js';

function request(headers = {}) {
  return { headers };
}

test('rejects requests without an Easy Auth principal', () => {
  assert.throws(
    () => assertAuthenticated(request(), {}),
    (error) => error.statusCode === 401,
  );
});

test('accepts requests carrying an Easy Auth principal', () => {
  const principal = assertAuthenticated(
    request({ 'x-ms-client-principal-id': 'abc', 'x-ms-client-principal-name': 'user@example.com' }),
    {},
  );
  assert.deepEqual(principal, { id: 'abc', name: 'user@example.com' });
});

test('REQUIRE_AUTH=false bypasses the check for local development', () => {
  const principal = assertAuthenticated(request(), { REQUIRE_AUTH: 'false' });
  assert.equal(principal.id, 'local-dev');
});

test('enforces ALLOWED_PRINCIPALS when configured', () => {
  const env = { ALLOWED_PRINCIPALS: 'allowed@example.com, other@example.com' };

  assert.doesNotThrow(() =>
    assertAuthenticated(
      request({ 'x-ms-client-principal-id': '1', 'x-ms-client-principal-name': 'Allowed@Example.com' }),
      env,
    ),
  );

  assert.throws(
    () =>
      assertAuthenticated(
        request({ 'x-ms-client-principal-id': '2', 'x-ms-client-principal-name': 'nope@example.com' }),
        env,
      ),
    (error) => error.statusCode === 403,
  );
});
