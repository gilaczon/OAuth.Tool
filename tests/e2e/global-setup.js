import { createServer } from 'vite';

// Stand in for the App Service settings that hold saved profiles in production.
// The secret lives only here, server-side, so the specs can assert it never
// reaches the browser.
export const E2E_PROFILE_SECRET = 'e2e-server-side-secret';

export default async function globalSetup() {
  process.env.REQUIRE_AUTH = 'false';
  process.env.OAUTH_PROFILES = JSON.stringify([
    {
      id: 'example-uat',
      name: 'Example UAT',
      tokenUrl: 'https://issuer.example.com/oauth2/token',
      clientId: 'profile-client-id',
      scope: 'api.read',
      authStyle: 'basic',
      secretSetting: 'OAUTH_SECRET_EXAMPLE_UAT',
    },
  ]);
  process.env.OAUTH_SECRET_EXAMPLE_UAT = E2E_PROFILE_SECRET;

  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  });

  await server.listen();

  return async () => {
    await server.close();
  };
}
