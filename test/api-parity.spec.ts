import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { AccountOptOut, GeoLocation } from '../src/account-settings.ts';
import { Track } from '../src/audio.ts';
import { discover, parseDiscoveryResponse } from '../src/discovery.ts';
import { Media, MediaPart } from '../src/media.ts';
import { MyPlexAccount, MyPlexUser } from '../src/myplex.ts';
import { Playlist } from '../src/playlist.ts';
import { Agent } from '../src/search.ts';
import { PlexServer } from '../src/server.ts';
import { Settings, type SettingResponse } from '../src/settings.ts';
import { Episode, Movie } from '../src/video.ts';

const setting: SettingResponse = {
  id: 'FriendlyName',
  label: 'Name',
  summary: '',
  type: 'text',
  default: '',
  value: 'Old',
  hidden: false,
  advanced: false,
  group: 'general',
};

function movie(server: PlexServer): Movie {
  return new Movie(server, {
    key: '/library/metadata/10',
    ratingKey: '10',
    librarySectionID: 1,
    type: 'movie',
    title: 'Test',
  });
}

describe('shared media controls', () => {
  it('retains the user ID on shares for scoped history queries', () => {
    const account = new MyPlexAccount({ token: 'test' });
    const user = new MyPlexUser(account, {
      $: { id: '42' },
      Server: [{ $: { id: '7', machineIdentifier: 'server-id' } }],
    });
    expect(user.servers[0].accountID).toBe(42);
  });
  it('rates music and clears ratings using the Plex reset sentinel', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Track(server, { key: '/library/metadata/12', ratingKey: '12', type: 'track' });
    const query = vi.spyOn(server, 'query').mockResolvedValue(null);
    vi.spyOn(item, 'reload').mockImplementation(async () => {});
    await item.rate(7.5);
    await item.rate(null);
    expect(query).toHaveBeenNthCalledWith(1, {
      path: '/:/rate?key=12&identifier=com.plexapp.plugins.library&rating=7.5',
      method: 'put',
    });
    expect(query).toHaveBeenNthCalledWith(2, {
      path: '/:/rate?key=12&identifier=com.plexapp.plugins.library&rating=-1',
      method: 'put',
    });
    await expect(item.rate(Number.NaN)).rejects.toThrow('Rating must be');
    await expect(item.rate(11)).rejects.toThrow('Rating must be');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('supports audio transcodes and DASH manifests', () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Track(server, { key: '/library/metadata/12', ratingKey: '12', type: 'track' });
    expect(new URL(item.getStreamURL()).pathname).toBe('/audio/:/transcode/universal/start.m3u8');
    const url = new URL(movie(server).getStreamURL({ protocol: 'dash', partIndex: '2' }));
    expect(url.pathname).toBe('/video/:/transcode/universal/start.mpd');
    expect(url.searchParams.get('partIndex')).toBe('2');
  });

  it('marks audio played and refreshes its state', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Track(server, {
      key: '/library/metadata/12',
      ratingKey: '12',
      type: 'track',
      viewCount: 1,
    });
    const query = vi.spyOn(server, 'query').mockResolvedValue(null);
    const reload = vi.spyOn(item, 'reload').mockImplementation(async () => {});
    expect(item.isPlayed).toBe(true);
    await item.markPlayed();
    await item.markUnplayed();
    expect(query).toHaveBeenNthCalledWith(1, {
      path: '/:/scrobble?key=12&identifier=com.plexapp.plugins.library',
    });
    expect(query).toHaveBeenNthCalledWith(2, {
      path: '/:/unscrobble?key=12&identifier=com.plexapp.plugins.library',
    });
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('settings persistence', () => {
  it('replaces removed settings after saving and rejects inherited property names', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    vi.spyOn(server, 'query').mockResolvedValue({ MediaContainer: { Setting: [] } });
    const settings = new Settings(server, [setting], '/:/prefs');
    settings.get(setting.id).set('New');
    await settings.save();
    expect(settings.all()).toEqual([]);
    expect(() => settings.get('constructor')).toThrow('Invalid setting id');
    expect(settings.groups().missing).toBeUndefined();
  });
  it('uses setting IDs and preserves false, zero, and empty string edits', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue({ MediaContainer: { Setting: [] } });
    const settings = new Settings(
      server,
      [
        setting,
        { ...setting, id: 'Enabled', type: 'bool', value: true, default: true },
        { ...setting, id: 'Limit', type: 'int', value: 5, default: 5 },
      ],
      '/:/prefs',
    );
    settings.get('FriendlyName').set('');
    settings.get('Enabled').set(false);
    settings.get('Limit').set(0);
    await settings.save();
    expect(query).toHaveBeenNthCalledWith(1, {
      path: '/:/prefs?Enabled=0&FriendlyName=&Limit=0',
      method: 'put',
    });
    expect(query).toHaveBeenNthCalledWith(2, { path: '/:/prefs' });
  });

  it('does not write when there are no pending changes', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query');
    const settings = new Settings(server, [setting], '/:/prefs');
    await settings.save();
    expect(query).not.toHaveBeenCalled();
    expect(settings.group('general')).toEqual(settings.all());
  });
});

describe('server administration', () => {
  it('reads the cached update status without triggering a check', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi
      .spyOn(server, 'query')
      .mockResolvedValue({ MediaContainer: { Release: [{ version: '2.0', state: 'available' }] } });
    const release = await server.checkForUpdate({ force: false });
    expect(release?.version).toBe('2.0');
    expect(query).toHaveBeenCalledExactlyOnceWith({ path: '/updater/status' });
  });

  it('does not install when no release is available', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue({ MediaContainer: {} });
    await server.installUpdate();
    expect(query.mock.calls).toEqual([
      [{ path: '/updater/check?download=1', method: 'put' }],
      [{ path: '/updater/status' }],
    ]);
  });

  it('applies an available downloaded release', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    server.version = '1.0';
    const query = vi
      .spyOn(server, 'query')
      .mockResolvedValue({ MediaContainer: { Release: [{ version: '2.0' }] } });
    await server.installUpdate();
    expect(query).toHaveBeenLastCalledWith({ path: '/updater/apply', method: 'put' });
  });

  it('encodes token options and returns the token', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi
      .spyOn(server, 'query')
      .mockResolvedValue({ MediaContainer: { token: 'delegation' } });
    expect(await server.createToken({ scope: 'a&b' })).toBe('delegation');
    expect(query).toHaveBeenCalledWith({ path: '/security/token?type=delegation&scope=a%26b' });
  });

  it('does not request delegation credentials for unclaimed servers', async () => {
    const server = new PlexServer('http://localhost:32400', '');
    const query = vi.spyOn(server, 'query');
    expect(await server.createToken()).toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('reads the MyPlex response root', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    vi.spyOn(server, 'query').mockResolvedValue({ MyPlex: { signInState: 'ok' } });
    expect(await server.account()).toEqual({ signInState: 'ok' });
  });
});

describe('metadata additions', () => {
  it('accepts frozen edit parameters without mutating them', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue(null);
    const changes = Object.freeze({ 'title.value': 'Frozen title' });
    await movie(server).edit(changes);
    const params = new URL(query.mock.calls[0][0].path).searchParams;
    expect(params.get('id')).toBe('10');
    expect(params.get('type')).toBe('1');
    expect(changes).toEqual({ 'title.value': 'Frozen title' });
  });

  it('clears playlist metadata using explicit empty strings', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue(null);
    await Playlist.update(server, '10', { title: '', summary: '' });
    expect(query).toHaveBeenCalledExactlyOnceWith({
      path: '/playlists/10?title=&summary=',
      method: 'put',
    });
  });

  it('serializes native stream option values and omits absent options', () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const url = new URL(
      movie(server).getStreamURL({ directPlay: false, partIndex: 2, offset: 0, custom: undefined }),
    );
    expect(url.searchParams.get('directPlay')).toBe('0');
    expect(url.searchParams.get('partIndex')).toBe('2');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.has('custom')).toBe(false);
  });
  it('serializes multiple typed edits in one request without mutating the input', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue(null);
    const item = movie(server);
    const fields = { title: 'A & B', userRating: 0, addedAt: new Date('2026-01-01T00:00:00Z') };
    await item.editFields(fields, { locked: false });
    const params = new URL(query.mock.calls[0][0].path).searchParams;
    expect(params.get('title.value')).toBe('A & B');
    expect(params.get('userRating.value')).toBe('0');
    expect(params.get('addedAt.value')).toBe('1767225600');
    expect(params.get('title.locked')).toBe('0');
    expect(params.get('id')).toBe('10');
    expect(query).toHaveBeenCalledTimes(1);
    expect(Object.keys(fields)).toEqual(['title', 'userRating', 'addedAt']);
    expectTypeOf(item.editFields)
      .parameter(0)
      .toEqualTypeOf<import('../src/metadata.ts').MetadataFieldUpdates>();
  });

  it('validates preferences and preserves false values', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue({
      MediaContainer: {
        Metadata: [
          {
            Preferences: {
              Setting: [{ ...setting, id: 'enabled', type: 'bool', value: true, default: true }],
            },
          },
        ],
      },
    });
    await movie(server).editAdvanced({ enabled: false });
    expect(query).toHaveBeenLastCalledWith({
      path: '/library/metadata/10/prefs?enabled=0',
      method: 'put',
    });
  });

  it('rejects unknown preferences before writing', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const query = vi.spyOn(server, 'query').mockResolvedValue({ MediaContainer: { Metadata: [] } });
    await expect(movie(server).editAdvanced({ unknown: 1 })).rejects.toThrow('Unknown preference');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('hydrates fields, colors, and episode cast', () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Episode(server, {
      key: '/library/metadata/1',
      type: 'episode',
      index: 3,
      Role: [{ tag: 'Actor' }],
      Field: [{ name: 'title', locked: true }],
      UltraBlurColors: { topLeft: 'ff0000' },
    });
    expect(item.isLocked('title')).toBe(true);
    expect(item.isLocked('summary')).toBe(false);
    expect(item.actors[0].tag).toBe('Actor');
    expect(item.episodeNumber).toBe(3);
    expect(item.ultraBlurColors?.topLeft).toBe('ff0000');
  });

  it('recognizes optimized versions and thumbnail indexes', () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    expect(new Media(server, { id: 1, Part: [], proxyType: 42 }).isOptimizedVersion).toBe(true);
    expect(new MediaPart(server, { id: 2, indexes: 'sd' }).hasPreviewThumbnails).toBe(true);
    expect(new MediaPart(server, { id: 3 }).hasPreviewThumbnails).toBe(false);
  });

  it('loads all agent media types and languages', () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const agent = new Agent(server, {
      identifier: 'tv.plex.agent',
      hasPrefs: false,
      MediaType: [
        { name: 'Movie', mediaType: 1, Language: [{ code: 'en' }, { code: 'fr' }] },
        { name: 'Show', mediaType: 2, Language: { code: 'en' } },
      ],
    });
    expect(agent.mediaTypes).toHaveLength(2);
    expect(agent.mediaTypes[0].languageCodes).toEqual(['en', 'fr']);
    expect(agent.languageCode).toBe('en');
  });
});

describe('account helpers', () => {
  it('reads the JSON ping response', async () => {
    const account = new MyPlexAccount({ token: 'test' });
    vi.spyOn(account, 'query').mockResolvedValue({ pong: true });
    expect(await account.ping()).toBe(true);
  });

  it('handles missing and malformed geographic coordinates honestly', () => {
    expect(new GeoLocation({ coordinates: '12.5,-30.2' }).coordinates).toEqual([12.5, -30.2]);
    expect(new GeoLocation({ coordinates: ',' }).coordinates).toBeUndefined();
    expect(new GeoLocation({ coordinates: 'bad,3' }).coordinates).toBeUndefined();
    expect(
      new GeoLocation({ european_union_member: 'Unknown' }).europeanUnionMember,
    ).toBeUndefined();
  });

  it('preserves unspecified privacy settings', async () => {
    const account = new MyPlexAccount({ token: 'test' });
    const query = vi.spyOn(account, 'query').mockResolvedValue(null);
    await account.optOut({ playback: false });
    expect(query).toHaveBeenCalledExactlyOnceWith({
      url: 'https://plex.tv/api/v2/user/privacy',
      method: 'put',
      body: { optOutPlayback: 0 },
    });
  });

  it('updates local visibility only after a successful request', async () => {
    const account = new MyPlexAccount({ token: 'test' });
    account.uuid = 'user';
    vi.spyOn(account, 'query').mockRejectedValue(new Error('offline'));
    const source = new AccountOptOut(account, 'provider', 'opt_in');
    await expect(source.setVisibility('opt_out')).rejects.toThrow('offline');
    expect(source.value).toBe('opt_in');
  });
});

describe('GDM discovery', () => {
  it('preserves header values containing colons and ignores unsuccessful replies', () => {
    expect(
      parseDiscoveryResponse('HTTP/1.0 200 OK\r\nName: Living: Room\r\nPort: 32400\r\n'),
    ).toEqual({ Name: 'Living: Room', Port: '32400' });
    expect(parseDiscoveryResponse('HTTP/1.0 404 Not Found')).toBeUndefined();
  });

  it('validates discovery windows and handles cancellation before opening a socket', async () => {
    await expect(discover({ timeout: 0 })).rejects.toThrow(RangeError);
    await expect(discover({ signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow(
      'cancelled',
    );
  });
});
