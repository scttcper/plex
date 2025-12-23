import { describe, expect, it } from 'vitest';

import { PlexServer } from '../src/server.js';

describe('PlexServer._buildWebURL', () => {
  const server = new PlexServer('http://localhost:32400', 'test-token');
  // Set machineIdentifier for testing
  server.machineIdentifier = 'abc123';

  it('should build URL with endpoint and params', () => {
    const params = new URLSearchParams({ key: '/library/metadata/123' });
    const result = server._buildWebURL('https://app.plex.tv/desktop/', 'details', params);
    expect(result).toBe(
      'https://app.plex.tv/desktop/#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F123',
    );
  });

  it('should build URL with endpoint but no params', () => {
    const result = server._buildWebURL('https://app.plex.tv/desktop/', 'playlist');
    expect(result).toBe('https://app.plex.tv/desktop/#!/server/abc123/playlist');
  });

  it('should build URL without endpoint (media URL)', () => {
    const params = new URLSearchParams({ source: 'library' });
    const result = server._buildWebURL('https://app.plex.tv/desktop/', undefined, params);
    expect(result).toBe(
      'https://app.plex.tv/desktop/#!/media/abc123/com.plexapp.plugins.library?source=library',
    );
  });

  it('should build URL without endpoint or params', () => {
    const result = server._buildWebURL();
    expect(result).toBe('https://app.plex.tv/desktop/#!/media/abc123/com.plexapp.plugins.library');
  });
});
