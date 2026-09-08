import { createSocket } from 'node:dgram';

export interface DiscoveryEntry {
  address: string;
  port: number;
  /** GDM response headers, including Name, Port, and Resource-Identifier when supplied. */
  data: Record<string, string>;
}

export interface DiscoveryOptions {
  /** Discover Plex players instead of servers. Defaults to false. */
  clients?: boolean;
  /** Discovery window in milliseconds. Defaults to 1000. */
  timeout?: number;
  signal?: AbortSignal;
  /** Filter response headers using exact matches. */
  filters?: Readonly<Record<string, string>>;
  /** Match a substring of the Content-Type header. */
  contentType?: string;
}

/** Discover Plex servers or players on the local network using GDM. */
export async function discover({
  clients = false,
  timeout = 1000,
  signal,
  filters = {},
  contentType,
}: DiscoveryOptions = {}): Promise<DiscoveryEntry[]> {
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError('Discovery timeout must be positive.');
  }
  signal?.throwIfAborted();
  const socket = createSocket({ type: 'udp4', reuseAddr: clients });
  const entries = new Map<string, DiscoveryEntry>();
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (error?: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      try {
        socket.close();
      } catch (closeError) {
        // A failed bind may leave the socket without a running handle.
        error ??= closeError;
      }
      if (error !== undefined) {
        reject(error);
      } else {
        resolve([...entries.values()]);
      }
    };
    const abort = (): void => finish(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    socket.on('error', finish);
    socket.on('message', (message, remote) => {
      const data = parseDiscoveryResponse(message.toString());
      if (!data || (contentType && !data['Content-Type']?.includes(contentType))) {
        return;
      }
      if (!Object.entries(filters).every(([key, value]) => data[key] === value)) {
        return;
      }
      const id = data['Resource-Identifier'] ?? `${remote.address}:${remote.port}`;
      entries.set(id, { address: remote.address, port: remote.port, data });
    });
    socket.bind(() => {
      if (settled) {
        return;
      }
      try {
        if (clients) {
          socket.setBroadcast(true);
        } else {
          socket.setMulticastTTL(1);
        }
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) {
          abort();
          return;
        }
        timer = setTimeout(() => finish(), timeout);
        socket.send(
          'M-SEARCH * HTTP/1.0',
          clients ? 32_412 : 32_414,
          clients ? '255.255.255.255' : '239.0.0.250',
          error => {
            if (error) {
              finish(error);
            }
          },
        );
      } catch (error) {
        finish(error);
      }
    });
  });
}

/** Parse a successful GDM response, preserving colons inside header values. */
export function parseDiscoveryResponse(response: string): Record<string, string> | undefined {
  const [status, ...lines] = response.split(/\r?\n/);
  if (!status || !/^HTTP\/\d(?:\.\d)? 200 OK\s*$/.test(status)) {
    return undefined;
  }
  const data: Record<string, string> = {};
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    Object.defineProperty(data, key, {
      value: line.slice(separator + 1).trim(),
      enumerable: true,
      configurable: true,
    });
  }
  return data;
}
