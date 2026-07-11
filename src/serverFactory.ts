import type { PlexServer } from './server.ts';

type PlexServerConstructor = typeof PlexServer;

let PlexServerClass: PlexServerConstructor | undefined;

export function registerPlexServer(serverClass: PlexServerConstructor): void {
  PlexServerClass = serverClass;
}

export function createPlexServer(
  ...args: ConstructorParameters<PlexServerConstructor>
): PlexServer {
  if (!PlexServerClass) {
    throw new Error('PlexServer is unavailable. Import from the package entry point.');
  }

  return new PlexServerClass(...args);
}
