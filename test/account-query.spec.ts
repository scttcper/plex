import { ofetch } from 'ofetch';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { MyPlexAccount } from '../src/myplex.ts';

vi.mock('ofetch', async importOriginal => ({
  ...(await importOriginal<typeof import('ofetch')>()),
  ofetch: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe('account response parsing', () => {
  it('infers text responses without a caller-supplied type', async () => {
    vi.mocked(ofetch).mockResolvedValue('  192.0.2.1\n');
    const account = new MyPlexAccount({ token: 'test' });
    const result = account.query({ url: 'https://plex.tv/:/ip', responseType: 'text' });
    expectTypeOf(result).toEqualTypeOf<Promise<string>>();
    expect(await result).toBe('192.0.2.1');
  });

  it('returns an empty string for an empty text response', async () => {
    vi.mocked(ofetch).mockResolvedValue('');
    const account = new MyPlexAccount({ token: 'test' });
    expect(await account.query({ url: 'https://plex.tv/:/ip', responseType: 'text' })).toBe('');
  });

  it('supports explicitly unknown structured responses', async () => {
    vi.mocked(ofetch).mockResolvedValue('{"pong":true}');
    const account = new MyPlexAccount({ token: 'test' });
    const result = account.query<unknown>({ url: 'https://plex.tv/api/v2/ping' });
    expectTypeOf(result).toEqualTypeOf<Promise<unknown>>();
    expect(await result).toEqual({ pong: true });
  });

  it('parses XML responses without forcing callers to handle text', async () => {
    vi.mocked(ofetch).mockResolvedValue('<MediaContainer size="0"/>');
    const account = new MyPlexAccount({ token: 'test' });
    expect(await account.query({ url: 'https://plex.tv/devices.xml' })).toEqual({
      MediaContainer: { $: { size: '0' } },
    });
  });
});
