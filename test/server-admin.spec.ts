import { beforeAll, describe, expect, it } from 'vitest';

import {
  Agent,
  ServerFile,
  ServerPath,
  type PlexServer,
  type ServerWalkEntry,
} from '../src/index.js';

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

  it('should get server agents', async () => {
    const agents = await plex.agents();
    const photoAgents = await plex.agents(13);

    expect(agents.find(agent => agent.identifier === 'tv.plex.agents.movie')).toBeInstanceOf(Agent);
    expect(photoAgents[0]).toBeInstanceOf(Agent);
    expect(photoAgents.map(agent => agent.identifier)).toContain('tv.plex.agents.none');
    expect(photoAgents[0].name).toBe('Plex Personal Media');
    expect(typeof photoAgents[0].languageCode).toBe('string');
  });

  it('should browse server folders and files', async () => {
    const folders = await plex.browse({ path: '/data', includeFiles: false });
    expect(folders.map(folder => folder.path)).toContain('/data/Movies');
    expect(folders.find(folder => folder.path === '/data/Movies')).toBeInstanceOf(ServerPath);

    const files = await plex.browse({ path: '/data/Movies' });
    expect(files.map(file => file.path)).toContain('/data/Movies/Big Buck Bunny (2008).mp4');
    expect(
      files.find(file => file.path === '/data/Movies/Big Buck Bunny (2008).mp4'),
    ).toBeInstanceOf(ServerFile);
  });

  it('should check browsable server paths', async () => {
    const browsable = await plex.isBrowsable('/data/Movies');
    expect(browsable).toBe(true);
  });

  it('should walk server paths', async () => {
    const entries: ServerWalkEntry[] = [];
    for await (const entry of plex.walk('/data/Movies')) {
      entries.push(entry);
    }
    expect(entries.map(entry => entry.path)).toEqual(['/data/Movies']);
    expect(entries[0].files.map(file => file.path)).toContain(
      '/data/Movies/Big Buck Bunny (2008).mp4',
    );
  });
});
