import { MyPlexAccount } from '../src/myplex';
import { PlexServer } from '../src/server';

export const username = process.env.PLEX_USERNAME as string;
export const password = process.env.PLEX_PASSWORD as string;
export const servername = 'ci-plex';

export async function createClient(): Promise<PlexServer> {
  const account = await new MyPlexAccount(
    username,
    password,
    undefined,
    undefined,
    undefined,
    'http://localhost:32400',
  ).connect();
  const resources = await account.resources();
  const sortedResources = resources.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const plex = sortedResources[0];
  const server = plex.connect();
  return server;
}
