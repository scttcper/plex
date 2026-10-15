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

import { assertDefined, first } from './assertions.ts';

beforeEach(() => {
  sockets.length = 0;
});

describe('alert listener lifecycle', () => {
  it('shares concurrent connections and delivers nonzero activity progress', async () => {
    const callback = vi.fn();
    const listener = new AlertListener(new PlexServer('https://plex.example', 'test'), callback);
    const firstRun = listener.run();
    const secondRun = listener.run();
    expect(sockets).toHaveLength(1);
    first(sockets).emit('open');
    await Promise.all([firstRun, secondRun]);
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
    first(sockets).emit(
      'message',
      Buffer.from(JSON.stringify({ NotificationContainer: notification })),
    );
    expect(callback).toHaveBeenCalledExactlyOnceWith(notification);
    listener.stop();
    expect(listener._ws).toBeUndefined();
    expect(first(sockets).listenerCount('message')).toBe(0);
  });

  it('rejects a failed connection and can connect again', async () => {
    const onError = vi.fn();
    const listener = new AlertListener(new PlexServer('http://plex.example', 'test'), vi.fn(), {
      onError,
    });
    const failure = new Error('connection refused');
    const failedRun = listener.run();
    const rejected = expect(failedRun).rejects.toBe(failure);
    first(sockets).emit('error', failure);
    first(sockets).emit('close');
    await rejected;
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    const next = listener.run();
    expect(sockets).toHaveLength(2);
    const [, retrySocket] = sockets;
    assertDefined(retrySocket);
    retrySocket.emit('open');
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
    first(sockets).emit('open');
    await connected;
    first(sockets).emit('message', Buffer.from('{'));
    first(sockets).emit('message', Buffer.from('{"NotificationContainer":null}'));
    first(sockets).emit('message', Buffer.from('{}'));
    expect(onError).toHaveBeenCalledTimes(3);
    expect(callback).not.toHaveBeenCalled();
    listener.stop();
  });
});
