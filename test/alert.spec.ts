import { beforeAll, expect, it, vi } from 'vitest';

import { AlertListener } from '../src/alert.ts';
import type { AlertTypes } from '../src/alert.types.ts';
import type { MovieSection } from '../src/library.ts';
import { PlexServer } from '../src/server.ts';

import { assertDefined } from './assertions.ts';
import { createClient } from './test-client.ts';

let plex: PlexServer;
let movies: MovieSection;

beforeAll(async () => {
  plex = await createClient();
  movies = await (await plex.library()).section<MovieSection>('Movies');
});

it('shares one connection and receives notifications from a library scan', async () => {
  const notifications: AlertTypes[] = [];
  const { promise: received, resolve } = Promise.withResolvers<void>();
  const listener = new AlertListener(plex, notification => {
    notifications.push(notification);
    resolve();
  });

  try {
    await Promise.all([listener.run(), listener.run()]);
    const socket = listener._ws;
    assertDefined(socket);
    expect(socket.readyState).toBe(WebSocket.OPEN);
    await listener.run();
    expect(listener._ws).toBe(socket);

    // Scanning an unchanged section is harmless and makes Plex report activity.
    await movies.update();
    await received;

    expect(notifications.length).toBeGreaterThan(0);
    expect(typeof notifications[0]?.type).toBe('string');
  } finally {
    listener.stop();
  }

  expect(listener._ws).toBeUndefined();
}, 30_000);

it('rejects a refused connection and can connect again', async () => {
  const onError = vi.fn();
  const unreachable = new PlexServer('http://127.0.0.1:9', 'test');
  const listener = new AlertListener(unreachable, vi.fn(), { onError });

  await expect(listener.run()).rejects.toThrow('Plex alert connection to http://127.0.0.1:9');
  expect(onError).toHaveBeenCalledOnce();
  expect(listener._ws).toBeUndefined();

  await expect(listener.run()).rejects.toThrow('Plex alert connection');
  expect(onError).toHaveBeenCalledTimes(2);
});
