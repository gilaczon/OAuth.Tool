import { test, expect } from '@playwright/test';
import { E2E_PROFILE_SECRET } from './global-setup.js';

const DEFAULT_TOKEN_URL =
  'https://login.microsoftonline.com/b618d97c-e68e-4843-8ea4-774f6b98a567/oauth2/v2.0/token';

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function testJwt() {
  return [
    encodeJwtPart({ alg: 'none', typ: 'JWT' }),
    encodeJwtPart({ sub: 'playwright-user', exp: 4_102_444_800, scope: 'api.read' }),
    'test-signature',
  ].join('.');
}

async function fillCredentials(page, scope = 'https://graph.microsoft.com/.default') {
  await page.getByLabel('Client ID').fill('playwright-client');
  await page.getByLabel('Client secret').fill('playwright-secret');
  await page.getByRole('textbox', { name: 'Scope optional' }).fill(scope);
}

async function mockTokenResponse(page, data, { status = 200, ok = true } = {}) {
  let requestBody;
  await page.route('**/api/token', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status,
        ok,
        data,
        requestedAt: '2026-07-19T00:00:00.000Z',
      }),
    });
  });
  return () => requestBody;
}

test('prefills an editable Microsoft token URL and gives scope guidance', async ({ page }) => {
  await page.goto('/');

  const tokenUrl = page.getByLabel('Token endpoint (OAuth2 URL)');
  await expect(tokenUrl).toHaveValue(DEFAULT_TOKEN_URL);

  const grantTooltip = page
    .locator('[role="tooltip"]')
    .filter({ hasText: 'This tool uses client_credentials' });
  await expect(grantTooltip).toBeHidden();
  await page.getByRole('button', { name: 'About the grant type' }).focus();
  await expect(grantTooltip).toBeVisible();

  const scopeTooltip = page
    .locator('[role="tooltip"]')
    .filter({ hasText: 'Microsoft client credentials normally use' });
  await expect(scopeTooltip).toBeHidden();
  await page.getByRole('button', { name: 'About Microsoft scopes' }).hover();
  await expect(scopeTooltip).toBeVisible();

  await page.getByRole('textbox', { name: 'Scope optional' }).fill('api.read');
  await expect(page.getByRole('alert')).toContainText('one Microsoft resource scope');

  await page
    .getByRole('textbox', { name: 'Scope optional' })
    .fill('api://first/.default https://graph.microsoft.com/.default');
  await expect(page.getByRole('alert')).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Scope optional' })
    .fill('https://graph.microsoft.com/.default');
  await expect(page.getByRole('alert')).toHaveCount(0);

  await tokenUrl.fill('https://issuer.example.com/oauth2/token');
  await expect(tokenUrl).toHaveValue('https://issuer.example.com/oauth2/token');
  await expect(page.getByText(/Microsoft client credentials normally use/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'About scopes' })).toBeVisible();
});

test('does not persist client credentials', async ({ page }) => {
  await page.goto('/');
  await fillCredentials(page);

  await page.reload();

  await expect(page.getByLabel('Client ID')).toHaveValue('');
  await expect(page.getByLabel('Client secret')).toHaveValue('');
});

test('requests and decodes a JWT while masking the raw token by default', async ({ page }) => {
  const accessToken = testJwt();
  const getRequestBody = await mockTokenResponse(page, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'api.read',
  });
  await page.goto('/');
  await fillCredentials(page);

  await page.getByRole('button', { name: 'Request Token' }).click();

  await expect(page.getByTestId('access-token-value')).toContainText('••••');
  await expect(page.getByTestId('access-token-value')).not.toContainText(accessToken);
  expect(getRequestBody().authStyle).toBe('body');

  const tokenTypeRow = page.locator('.prop').filter({ hasText: 'token_type' });
  await expect(tokenTypeRow).toContainText('Bearer');
  expect(await tokenTypeRow.evaluate((element) => getComputedStyle(element).flexDirection)).toBe(
    'row',
  );

  const decodedTab = page.getByRole('tab', { name: 'Decoded token' });
  const rawTab = page.getByRole('tab', { name: 'Raw decoded payload' });
  await expect(rawTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('raw-decoded-payload')).toContainText('playwright-user');
  await expect(page.getByText('Header', { exact: true })).toHaveCount(0);
  await decodedTab.click();
  await expect(decodedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Header', { exact: true })).toBeVisible();
  await expect(page.getByText('playwright-user', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reveal access token' }).click();
  await expect(page.getByTestId('access-token-value')).toContainText(accessToken);
  await page.getByRole('button', { name: 'Hide access token' }).click();
  await expect(page.getByTestId('access-token-value')).not.toContainText(accessToken);
});

test('retains the Basic-header authentication option', async ({ page }) => {
  const getRequestBody = await mockTokenResponse(page, {
    access_token: 'opaque-token',
    token_type: 'Bearer',
  });
  await page.goto('/');
  await fillCredentials(page);

  const authTooltip = page
    .locator('[role="tooltip"]')
    .filter({ hasText: 'Chooses how client_id and client_secret are sent' });
  await expect(authTooltip).toBeHidden();
  await page.getByRole('button', { name: 'About client authentication' }).hover();
  await expect(authTooltip).toBeVisible();

  await page.getByRole('button', { name: 'Basic header' }).click();
  await page.getByRole('button', { name: 'Request Token' }).click();

  await expect(page.getByRole('tab', { name: 'Raw decoded payload' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Decoded token' }).click();
  await expect(page.getByText("This access token isn't a JWT")).toBeVisible();
  expect(getRequestBody().authStyle).toBe('basic');
});

test('shows OAuth errors returned by the token endpoint', async ({ page }) => {
  await mockTokenResponse(
    page,
    { error: 'invalid_client', error_description: 'The client credentials are invalid.' },
    { status: 401, ok: false },
  );
  await page.goto('/');
  await fillCredentials(page);

  await page.getByRole('button', { name: 'Request Token' }).click();

  await expect(page.getByRole('heading', { name: 'Token endpoint returned 401' })).toBeVisible();
  await expect(page.getByText('The client credentials are invalid.', { exact: true })).toBeVisible();
});

test('clears credentials and token results on demand', async ({ page }) => {
  await mockTokenResponse(page, {
    access_token: testJwt(),
    token_type: 'Bearer',
    expires_in: 3600,
  });
  await page.goto('/');
  await fillCredentials(page);
  await page.getByRole('button', { name: 'Request Token' }).click();
  await expect(page.getByRole('heading', { name: 'Token', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Clear credentials & results' }).click();

  await expect(page.getByLabel('Client ID')).toHaveValue('');
  await expect(page.getByLabel('Client secret')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'No token yet' })).toBeVisible();
});

test('uses a saved profile without exposing its secret to the browser', async ({ page }) => {
  const getRequestBody = await mockTokenResponse(page, {
    access_token: 'opaque-token',
    token_type: 'Bearer',
  });
  await page.goto('/');

  await page.getByLabel('Saved profile', { exact: true }).selectOption('example-uat');

  // The profile supplies the whole request; the secret input becomes a note and
  // every field the profile controls is locked.
  await expect(page.getByLabel('Client ID')).toHaveValue('profile-client-id');
  await expect(page.locator('#clientSecret')).toHaveCount(0);
  await expect(page.getByText('Provided by the server')).toBeVisible();

  await expect(page.getByLabel('Token endpoint (OAuth2 URL)')).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Client ID')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('textbox', { name: 'Scope optional' })).toHaveAttribute(
    'readonly',
    '',
  );

  await page.getByRole('button', { name: 'Request Token' }).click();

  const body = getRequestBody();
  expect(body.profileId).toBe('example-uat');
  expect(body.clientSecret).toBeUndefined();

  // The metadata endpoint must never carry the secret itself.
  const payload = await (await page.request.get('/api/profiles')).text();
  expect(payload).not.toContain(E2E_PROFILE_SECRET);
  expect(payload).toContain('profile-client-id');
});

test('switching back to manual entry restores the secret field', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Saved profile', { exact: true }).selectOption('example-uat');
  await expect(page.locator('#clientSecret')).toHaveCount(0);

  await page.getByLabel('Saved profile', { exact: true }).selectOption('');

  await expect(page.locator('#clientSecret')).toBeVisible();
  await expect(page.getByLabel('Client ID')).toHaveValue('');

  // Everything the profile had locked is editable again.
  await expect(page.getByLabel('Token endpoint (OAuth2 URL)')).not.toHaveAttribute('readonly', '');
  await expect(page.getByRole('textbox', { name: 'Scope optional' })).not.toHaveAttribute(
    'readonly',
    '',
  );
});

test('remembers the selected profile across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Saved profile', { exact: true }).selectOption('example-uat');

  await page.reload();

  await expect(page.getByLabel('Saved profile', { exact: true })).toHaveValue('example-uat');
  await expect(page.getByLabel('Client ID')).toHaveValue('profile-client-id');
});

test('automatically clears sensitive data after five minutes', async ({ page }) => {
  await page.clock.install();
  await mockTokenResponse(page, {
    access_token: testJwt(),
    token_type: 'Bearer',
    expires_in: 3600,
  });
  await page.goto('/');
  await fillCredentials(page);
  await page.getByRole('button', { name: 'Request Token' }).click();
  await expect(page.getByRole('heading', { name: 'Token', exact: true })).toBeVisible();

  await page.clock.fastForward(5 * 60 * 1000 + 1);

  await expect(page.getByLabel('Client ID')).toHaveValue('');
  await expect(page.getByLabel('Client secret')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'No token yet' })).toBeVisible();
});
