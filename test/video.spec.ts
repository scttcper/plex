import { describe, it, beforeAll, expect } from '@jest/globals';

import { PlexServer, ShowSection, MovieSection, Show, Movie, Hub, Folder } from '../src';
import { createClient } from './test-client';

describe('Shows', () => {
  let plex: PlexServer;
  /** Game of thrones */
  let show: Show;
  let showSection: ShowSection;
  beforeAll(async () => {
    plex = await createClient();
    const library = await plex.library();
    showSection = await library.section<ShowSection>('TV Shows');
    const results = await showSection.search({ title: 'Game of Thrones' });
    show = results[0];
  });

  it("should get a shows's episodes", async () => {
    const episodes = await show.episodes();
    // 2 seasons of GoT
    expect(episodes.length).toBe(20);
  });

  it("should get a season's episodes", async () => {
    const seasons = await show.seasons();
    const episodes = await seasons[0].episodes();
    // Season 1 of GoT
    expect(episodes.length).toBe(10);
  });

  it("should get an episode's full data", async () => {
    const [season] = await show.seasons();
    const [episode] = await season.episodes();
    expect(episode.isFullObject).toBeFalsy();
    await episode.reload();
    expect(episode.isFullObject).toBeTruthy();
  });

  it("should get a episode's season and show", async () => {
    const seasons = await show.seasons();
    const episodes = await seasons[0].episodes();
    const [episode] = episodes;
    // Season 1 of GoT
    expect((await episode.season()).key).toBe(seasons[0].key);
    expect((await episode.show()).key).toBe(show.key);
    expect(episode.isWatched).toBe(false);
  });

  // Markers don't seem to be available from json? Or in the test env
  it('should determine if an episode has makers', async () => {
    const seasons = await show.seasons();
    const episodes = await seasons[0].episodes();
    const [episode] = episodes;
    expect(await episode.hasIntroMarker()).toBe(false);
  });

  it('should load all episode extra data', async () => {
    const episodes = await show.episodes();
    const [episode] = episodes;
    expect(episode.writers.length).toBe(2);
    expect(episode.grandparentTitle).toBe('Game of Thrones');
    expect(await episode.seasonNumber()).toBe(1);
  });

  it('should get show locations', async () => {
    const episodes = await show.episodes();
    const [episode] = episodes;
    expect(episode.locations()).toEqual(['/data/shows/Game of Thrones/S01E01.mp4']);
  });

  it('should get show hubs', async () => {
    const hubs = await showSection.hubs();
    expect(hubs.length).toBe(5);
    expect(hubs[0].type).toBe('episode');
  });

  it('should get show folders', async () => {
    const folders = await showSection.folders();
    expect(folders.length).toBe(2);
    expect(folders[0].title).toBeDefined();
  });
});

describe('Movies', () => {
  let plex: PlexServer;
  /** Big buck bunny */
  let movie: Movie;
  beforeAll(async () => {
    plex = await createClient();
    const library = await plex.library();
    const section = await library.section<MovieSection>('Movies');
    const results = await section.search({ title: 'Bunny' });
    movie = results[0];
  });

  it('should reutrn roles as actors', () => {
    expect(movie.actors).toEqual(movie.roles);
  });

  it('should get movie locations', async () => {
    expect(await movie.locations()).toEqual(['/data/movies/Big Buck Bunny (2008).mp4']);
  });
});
