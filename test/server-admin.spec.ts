import { beforeAll, describe, expect, it } from 'vitest';

import type { PlexServer } from '../src/index.js';

import { createClient } from './test-client.js';

let plex: PlexServer;
beforeAll(async () => {
  plex = await createClient();
});

describe('Server Admin Methods', () => {
  it('should get active sessions (may be empty)', async () => {
    const sessions = await plex.sessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('should get transcode sessions (may be empty)', async () => {
    const sessions = await plex.transcodeSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('should get activities (may be empty)', async () => {
    const activities = await plex.activities();
    expect(Array.isArray(activities)).toBe(true);
  });

  it('should get butler tasks', async () => {
    const tasks = await plex.butlerTasks();
    expect(tasks.length).toBeGreaterThan(0);
    const task = tasks[0];
    expect(task.name).toBeTruthy();
    expect(typeof task.enabled).toBe('boolean');
    expect(typeof task.interval).toBe('number');
  });

  it('should get system accounts', async () => {
    const accounts = await plex.systemAccounts();
    expect(accounts.length).toBeGreaterThan(0);
    const account = accounts[0];
    expect(typeof account.accountID).toBe('number');
  });

  it('should get system devices', async () => {
    const devices = await plex.systemDevices();
    expect(devices.length).toBeGreaterThan(0);
    const device = devices[0];
    expect(typeof device.deviceID).toBe('number');
    expect(typeof device.name).toBe('string');
  });

  it('should get bandwidth stats (may be empty)', async () => {
    const stats = await plex.bandwidth();
    expect(Array.isArray(stats)).toBe(true);
  });

  it('should get resource stats (may be empty)', async () => {
    const stats = await plex.resources();
    expect(Array.isArray(stats)).toBe(true);
  });

  it('should build a transcode image URL', () => {
    const url = plex.transcodeImage({
      url: '/library/metadata/1/thumb/12345',
      width: 300,
      height: 200,
    });
    const urlStr = url.toString();
    expect(urlStr).toContain('/photo/:/transcode');
    expect(urlStr).toContain('width=300');
    expect(urlStr).toContain('height=200');
    expect(urlStr).toContain('X-Plex-Token=');
  });

  it('should build a transcode image URL with opacity', () => {
    const url = plex.transcodeImage({
      url: '/library/metadata/1/thumb/12345',
      width: 100,
      height: 100,
      opacity: 50,
    });
    expect(url.toString()).toContain('opacity=50');
  });

  it('should get continueWatching (may be empty)', async () => {
    const items = await plex.continueWatching();
    expect(Array.isArray(items)).toBe(true);
  });
});
