import { afterEach, expect, it, vi } from 'vitest';

import { BASE_HEADERS, setPlexHeaders } from '../src/config.ts';
import { PlexServer } from '../src/server.ts';

const defaultHeaders = { ...BASE_HEADERS };

afterEach(() => {
  Object.assign(BASE_HEADERS, defaultHeaders);
  vi.restoreAllMocks();
});

it('sends overridden X-Plex headers with server requests', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ MediaContainer: { size: 0 } }));
  setPlexHeaders({ product: 'My App', version: '2.0.0', identifier: 'install-1' });

  await new PlexServer('http://localhost:32400', 'token').query({ path: '/identity' });

  const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
  expect(headers.get('X-Plex-Product')).toBe('My App');
  expect(headers.get('X-Plex-Version')).toBe('2.0.0');
  expect(headers.get('X-Plex-Client-Identifier')).toBe('install-1');
  expect(headers.get('X-Plex-Device-Name')).toBe(defaultHeaders['X-Plex-Device-Name']);
});
