import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedAddress, validateTokenUrl } from './tokenHandler.js';

test('blocks private and reserved IPv4 addresses', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.51.100.1',
    '224.0.0.1',
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress('8.8.8.8'), false);
});

test('blocks private IPv6 addresses', () => {
  for (const address of ['::1', 'fc00::1', 'fe80::1', '2001:db8::1', '::ffff:127.0.0.1']) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress('2606:4700:4700::1111'), false);
});

test('requires HTTPS and rejects embedded credentials', async () => {
  await assert.rejects(validateTokenUrl('http://8.8.8.8/token'), /must use HTTPS/);
  await assert.rejects(
    validateTokenUrl('https://user:pass@8.8.8.8/token'),
    /must not contain embedded credentials/,
  );
});

test('rejects hostnames that resolve to private addresses', async () => {
  const lookupFn = async () => [{ address: '127.0.0.1', family: 4 }];
  await assert.rejects(
    validateTokenUrl('https://issuer.example/token', { lookupFn }),
    /private or reserved networks/,
  );
});

test('accepts a public HTTPS endpoint', async () => {
  const url = await validateTokenUrl('https://8.8.8.8/token');
  assert.equal(url.href, 'https://8.8.8.8/token');
});
