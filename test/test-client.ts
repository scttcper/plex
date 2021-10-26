import { MyPlexAccount, PlexServer } from '../src';

export const username = process.env.PLEX_USERNAME;
export const password = process.env.PLEX_PASSWORD;
export const token = process.env.PLEX_TOKEN ?? process.env.PLEXAPI_AUTH_SERVER_TOKEN;

if (!username && !password && !token) {
  console.error('Test environment variables must be set.');
  process.exit(1);
}

export async function createAccount(): Promise<MyPlexAccount> {
  const account = await new MyPlexAccount(
    'http://localhost:32400',
    username,
    password,
    token,
  ).connect();
  return account;
}

export async function createClient(): Promise<PlexServer> {
  const account = await createAccount();
  const resources = await account.resources();
  const sortedResources = resources.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const plex = sortedResources[0];
  const server = await plex.connect(undefined, 2000);
  return server;
}
