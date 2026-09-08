import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sockets } = vi.hoisted(() => ({ sockets: [] as EventEmitter[] }));
vi.mock('ws', () => ({
  default: class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    readyState = 0;
    readonly url: URL;
    constructor(url: URL) {
      super();
      this.url = url;
      sockets.push(this);
    }
    close(): void {
      this.emit('close');
    }
  },
}));

import { AlertListener } from '../src/alert.ts';
import type { ActivityNotification } from '../src/alert.types.ts';
import { PlexServer } from '../src/server.ts';

beforeEach(() => {
  sockets.length = 0;
});

describe('alert listener lifecycle', () => {
  it('shares concurrent connections and delivers nonzero activity progress', async () => {
    const callback = vi.fn();
    const listener = new AlertListener(new PlexServer('https://plex.example', 'test'), callback);
    const first = listener.run();
    const second = listener.run();
    expect(sockets).toHaveLength(1);
    sockets[0].emit('open');
    await Promise.all([first, second]);
    const notification = {
      type: 'activity',
      size: 1,
      ActivityNotification: [
        {
          event: 'updated',
          uuid: 'activity-id',
          Activity: {
            uuid: 'activity-id',
            type: 'media.optimize',
            cancellable: true,
            userID: 42,
            title: 'Optimizing',
            subtitle: '',
            progress: 75,
          },
        },
      ],
    } satisfies ActivityNotification;
    sockets[0].emit(
      'message',
      Buffer.from(JSON.stringify({ NotificationContainer: notification })),
    );
    expect(callback).toHaveBeenCalledExactlyOnceWith(notification);
    listener.stop();
    expect(listener._ws).toBeUndefined();
    expect(sockets[0].listenerCount('message')).toBe(0);
  });

  it('rejects a failed connection and can connect again', async () => {
    const onError = vi.fn();
    const listener = new AlertListener(new PlexServer('http://plex.example', 'test'), vi.fn(), {
      onError,
    });
    const failure = new Error('connection refused');
    const first = listener.run();
    const rejected = expect(first).rejects.toBe(failure);
    sockets[0].emit('error', failure);
    sockets[0].emit('close');
    await rejected;
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    const next = listener.run();
    expect(sockets).toHaveLength(2);
    sockets[1].emit('open');
    await next;
    listener.stop();
  });

  it('settles a connection stopped before opening', async () => {
    const listener = new AlertListener(new PlexServer('http://plex.example', 'test'), vi.fn());
    const connected = listener.run();
    const rejected = expect(connected).rejects.toThrow('closed before opening');
    listener.stop();
    await rejected;
    expect(listener._ws).toBeUndefined();
  });

  it('reports malformed messages without invoking the callback', async () => {
    const callback = vi.fn();
    const onError = vi.fn();
    const listener = new AlertListener(new PlexServer('http://plex.example', 'test'), callback, {
      onError,
    });
    const connected = listener.run();
    sockets[0].emit('open');
    await connected;
    sockets[0].emit('message', Buffer.from('{'));
    sockets[0].emit('message', Buffer.from('{"NotificationContainer":null}'));
    sockets[0].emit('message', Buffer.from('{}'));
    expect(onError).toHaveBeenCalledTimes(3);
    expect(callback).not.toHaveBeenCalled();
    listener.stop();
  });
});
