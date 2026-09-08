import assert from 'node:assert/strict';

import { beforeAll, expect, it } from 'vitest';

import {
  AgentMediaType,
  GeoLocation,
  type Movie,
  type MovieSection,
  type MyPlexAccount,
  type PlexServer,
} from '../src/index.ts';

import { createAccount, createClient } from './test-client.ts';

let server: PlexServer;
let account: MyPlexAccount;
let movie: Movie;

beforeAll(async () => {
  server = await createClient();
  account = await createAccount();
  const library = await server.library();
  const section = await library.section<MovieSection>('Movies');
  [movie] = await section.all();
  expect(movie).toBeDefined();
  await movie.reload();
});

it('reads typed server identity, account, and updater status', async () => {
  const identity = await server.identity();
  const localAccount = await server.account();
  expect(identity.machineIdentifier).toBe(server.machineIdentifier);
  expect(typeof identity.claimed).toBe('boolean');
  expect(typeof localAccount.signInState).toBe('string');
  expect(typeof (await server.canInstallUpdate())).toBe('boolean');
  await server.checkForUpdate({ force: false });
});

it('finds system accounts and devices by ID', async () => {
  const [systemAccount] = await server.systemAccounts();
  const [device] = await server.systemDevices();
  expect((await server.systemAccount(systemAccount.accountID)).accountID).toBe(
    systemAccount.accountID,
  );
  expect((await server.systemDevice(device.deviceID)).deviceID).toBe(device.deviceID);
});

it('reads metadata preferences and loaded optional flags', async () => {
  const preferences = await movie.preferences();
  expect(preferences.length).toBeGreaterThan(0);
  const first = preferences[0];
  expect((await movie.preference(first.id)).value).toEqual(first.value);
  expect(typeof movie.hasPreviewThumbnails).toBe('boolean');
  expect(typeof movie.hasVoiceActivity).toBe('boolean');
  expect(typeof movie.ultraBlurColors?.topLeft).toBe('string');
  expect(Array.isArray(await movie.reviews())).toBe(true);
  expect((await server.source(movie))?.ratingKey).toBe(movie.ratingKey);
  expect(movie.metadataDirectory).toMatch(/^Metadata\/Movies\/[a-f0-9]\/[a-f0-9]+\.bundle$/);
});

it('streams an original file and stops without downloading the entire video', async () => {
  const downloads = movie.download();
  const first = await downloads.next();
  assert(first.done === false);
  const file = first.value;
  expect(file.filename).not.toContain('/');
  const reader = file.body.getReader();
  try {
    const chunk = await reader.read();
    expect(chunk.done).toBe(false);
    expect(chunk.value!.byteLength).toBeGreaterThan(0);
  } finally {
    await reader.cancel();
    reader.releaseLock();
    await downloads.return();
  }
});

it('reads account ping, IP, location, and online-source preferences', async () => {
  expect(await account.ping()).toBe(true);
  expect(typeof (await account.publicIP())).toBe('string');
  const location = await account.geoip('8.8.8.8');
  expect(location).toBeInstanceOf(GeoLocation);
  expect(typeof location.code).toBe('string');
  const sources = await account.onlineMediaSources();
  expect(Array.isArray(sources)).toBe(true);
});

it('retains all agent media types when advertised', async () => {
  const agents = await server.agents();
  expect(agents.length).toBeGreaterThan(0);
  expect(Array.isArray(agents[0].mediaTypes)).toBe(true);
  expect(
    agents.flatMap(agent => agent.mediaTypes).every(type => type instanceof AgentMediaType),
  ).toBe(true);
});
