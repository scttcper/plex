import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const mediaDir = path.join(import.meta.dirname, '../media/');
const moviesDir = path.join(mediaDir, './movies/');
const tvDir = path.join(mediaDir, './shows/');
const audioDir = path.join(mediaDir, './music/');
const videoStubPath = path.join(import.meta.dirname, '../test/data/video_stub.mp4');
const audioStubPath = path.join(import.meta.dirname, '../test/data/audio_stub.mp3');

export async function downloadVideoFile(): Promise<void> {
  console.log('Downloading video_stub.mp4..');
  const response = await fetch(
    'http://www.mytvtestpatterns.com/mytvtestpatterns/Default/GetFile?p=PhilipsCircleMP4',
  );
  if (!response.ok) {
    throw new Error(`Video stub download failed: ${response.status} ${response.statusText}`);
  }
  await writeFile(videoStubPath, new Uint8Array(await response.arrayBuffer()));
}

export const requiredMovies = {
  'Elephants Dream': 2006,
  'Sita Sings the Blues': 2008,
  'Big Buck Bunny': 2008,
  Sintel: 2010,
  'The Lincoln Lawyer': 2011,
  Ghostbusters: 1984,
  'Step Brothers': 2008,
};

export async function prepareMovieDir(moviePath = moviesDir): Promise<void> {
  for (const [name, year] of Object.entries(requiredMovies)) {
    await copyFile(videoStubPath, path.join(moviePath, `${name} (${year}).mp4`));
  }
}

export const requiredShows = {
  'Silicon Valley': [
    Array.from({ length: 8 }, (_, i) => i + 1),
    Array.from({ length: 10 }, (_, i) => i + 1),
  ],
  'The 100': [
    Array.from({ length: 14 }, (_, i) => i + 1),
    Array.from({ length: 17 }, (_, i) => i + 1),
  ],
};

export async function prepareTvDir(showPath = tvDir): Promise<void> {
  for (const [name, seasons] of Object.entries(requiredShows)) {
    const showDir = path.join(showPath, name);
    await mkdir(showDir, { recursive: true });

    for (const [index, season] of seasons.entries()) {
      for (const episode of season) {
        const episodePath = path.join(
          showDir,
          `/S${(index + 1).toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}.mp4`,
        );
        await copyFile(videoStubPath, episodePath);
      }
    }
  }
}

export const requiredAudio = {
  Ladytron: {
    'Light & Magic': ['2 - Seventeen.mp3', '3 - Flicking Your Switch.mp3', '9 - Evil.mp3'],
    'Witching Hour': ['2 - Destroy Everything You Touch.mp3'],
  },
  Radiohead: {
    'OK Computer': ['6 - Karma Police.mp3'],
  },
};

export async function prepareAudioDir(audioPath = audioDir): Promise<void> {
  for (const [artist, albums] of Object.entries(requiredAudio)) {
    for (const [album, songs] of Object.entries(albums)) {
      const albumDir = path.join(audioPath, `${artist} - ${album}`);
      await mkdir(albumDir, { recursive: true });

      for (const song of songs) {
        await copyFile(audioStubPath, path.join(albumDir, song));
      }
    }
  }
}

export async function createAll(): Promise<void> {
  await downloadVideoFile();
  await prepareMovieDir();
  await prepareTvDir();
  await prepareAudioDir();
}
