import test from 'node:test';
import assert from 'node:assert/strict';
import { listProfiles, loadProfiles, resolveTokenRequest } from './profiles.js';

const SECRET = 'super-secret-value';

function env(overrides = {}) {
  return {
    OAUTH_PROFILES: JSON.stringify([
      {
        id: 'uat',
        name: 'Example UAT',
        tokenUrl: 'https://issuer.example.com/oauth2/token',
        clientId: 'client-uat',
        scope: 'api.read',
        authStyle: 'basic',
        secretSetting: 'OAUTH_SECRET_UAT',
      },
    ]),
    OAUTH_SECRET_UAT: SECRET,
    ...overrides,
  };
}

test('returns an empty list when unconfigured', () => {
  assert.deepEqual(loadProfiles({}), []);
  assert.deepEqual(listProfiles({}), []);
});

test('rejects malformed configuration instead of degrading to an empty list', () => {
  assert.throws(() => loadProfiles({ OAUTH_PROFILES: '{' }), (e) => e.statusCode === 500);
  assert.throws(() => loadProfiles({ OAUTH_PROFILES: '{}' }), (e) => e.statusCode === 500);
  assert.throws(
    () => loadProfiles({ OAUTH_PROFILES: '[{"id":"a"}]' }),
    (e) => e.statusCode === 500,
  );
  assert.throws(
    () =>
      loadProfiles(
        env({
          OAUTH_PROFILES: JSON.stringify([
            { id: 'a', name: 'a', tokenUrl: 'u', clientId: 'c', secretSetting: 's', authStyle: 'weird' },
          ]),
        }),
      ),
    (e) => e.statusCode === 500,
  );
});

test('rejects duplicate profile ids', () => {
  const duplicate = {
    id: 'same',
    name: 'Same',
    tokenUrl: 'https://issuer.example.com/oauth2/token',
    clientId: 'c',
    secretSetting: 'OAUTH_SECRET_UAT',
  };
  assert.throws(
    () => loadProfiles({ OAUTH_PROFILES: JSON.stringify([duplicate, duplicate]) }),
    (e) => e.statusCode === 500,
  );
});

test('client-visible metadata never carries the secret or its setting name', () => {
  const [profile] = listProfiles(env());

  assert.deepEqual(profile, {
    id: 'uat',
    name: 'Example UAT',
    tokenUrl: 'https://issuer.example.com/oauth2/token',
    clientId: 'client-uat',
    scope: 'api.read',
    authStyle: 'basic',
  });
  assert.ok(!JSON.stringify(profile).includes(SECRET));
  assert.ok(!JSON.stringify(profile).includes('OAUTH_SECRET_UAT'));
});

test('passes through bodies that do not reference a profile', () => {
  const body = { tokenUrl: 'https://other.example.com/token', clientId: 'x', clientSecret: 'y' };
  assert.deepEqual(resolveTokenRequest(body, env()), body);
});

test('expands a profile reference into a full token request', () => {
  const resolved = resolveTokenRequest({ profileId: 'uat' }, env());

  assert.equal(resolved.tokenUrl, 'https://issuer.example.com/oauth2/token');
  assert.equal(resolved.clientId, 'client-uat');
  assert.equal(resolved.clientSecret, SECRET);
  assert.equal(resolved.scope, 'api.read');
  assert.equal(resolved.authStyle, 'basic');
  assert.ok(!('profileId' in resolved));
});

test('lets the caller override scope and authStyle but not the credentials or endpoint', () => {
  const resolved = resolveTokenRequest(
    {
      profileId: 'uat',
      scope: '',
      authStyle: 'body',
      // An attacker-controlled endpoint must not be able to receive the secret.
      tokenUrl: 'https://attacker.example/collect',
      clientId: 'spoofed',
      clientSecret: 'spoofed',
    },
    env(),
  );

  assert.equal(resolved.scope, '');
  assert.equal(resolved.authStyle, 'body');
  assert.equal(resolved.tokenUrl, 'https://issuer.example.com/oauth2/token');
  assert.equal(resolved.clientId, 'client-uat');
  assert.equal(resolved.clientSecret, SECRET);
});

test('reports unknown profiles and missing secret settings distinctly', () => {
  assert.throws(
    () => resolveTokenRequest({ profileId: 'nope' }, env()),
    (e) => e.statusCode === 404,
  );
  assert.throws(
    () => resolveTokenRequest({ profileId: 'uat' }, env({ OAUTH_SECRET_UAT: undefined })),
    (e) => e.statusCode === 500,
  );
});
