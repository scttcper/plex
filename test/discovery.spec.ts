import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSocket } = vi.hoisted(() => ({ createSocket: vi.fn() }));
vi.mock('node:dgram', () => ({ createSocket }));

import { discover } from '../src/discovery.ts';

function socket() {
  return Object.assign(new EventEmitter(), {
    bind: vi.fn((callback: () => void) => queueMicrotask(callback)),
    close: vi.fn(),
    setBroadcast: vi.fn(),
    setMulticastTTL: vi.fn(),
    send: vi.fn(),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GDM lifecycle', () => {
  it('closes the socket on cancellation', async () => {
    const udp = socket();
    createSocket.mockReturnValue(udp);
    const controller = new AbortController();
    const result = discover({ signal: controller.signal });
    const rejected = expect(result).rejects.toThrow('cancel discovery');
    await Promise.resolve();
    controller.abort(new Error('cancel discovery'));
    await rejected;
    expect(udp.close).toHaveBeenCalledTimes(1);
  });

  it('preserves bind errors even when closing an unbound socket fails', async () => {
    const udp = socket();
    const failure = new Error('bind failed');
    udp.bind.mockImplementation(() => {
      queueMicrotask(() => udp.emit('error', failure));
    });
    udp.close.mockImplementation(() => {
      throw new Error('not running');
    });
    createSocket.mockReturnValue(udp);
    await expect(discover()).rejects.toBe(failure);
    expect(udp.close).toHaveBeenCalledTimes(1);
  });

  it('filters and deduplicates responses during the discovery window', async () => {
    vi.useFakeTimers();
    try {
      const udp = socket();
      createSocket.mockReturnValue(udp);
      const result = discover({ timeout: 100, filters: { Name: 'Test' } });
      await Promise.resolve();
      const message = Buffer.from(
        'HTTP/1.0 200 OK\r\nName: Test\r\nResource-Identifier: abc\r\nPort: 32400\r\n',
      );
      udp.emit('message', message, { address: '192.0.2.1', port: 32_414 });
      udp.emit('message', message, { address: '192.0.2.1', port: 32_414 });
      udp.emit('message', Buffer.from('HTTP/1.0 200 OK\r\nName: Other\r\n'), {
        address: '192.0.2.2',
        port: 32_414,
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(await result).toEqual([
        {
          address: '192.0.2.1',
          port: 32_414,
          data: { Name: 'Test', 'Resource-Identifier': 'abc', Port: '32400' },
        },
      ]);
      expect(udp.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
