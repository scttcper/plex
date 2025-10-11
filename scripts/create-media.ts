import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
const mediaDir = path.join(__dirname, '../media/');
const moviesDir = path.join(mediaDir, './movies/');
const tvDir = path.join(mediaDir, './shows/');
const audioDir = path.join(mediaDir, './music/');
const videoStubPath = path.join(__dirname, '../test/data/video_stub.mp4');
const audioStubPath = path.join(__dirname, '../test/data/audio_stub.mp3');

export async function downloadVideoFile(): Promise<void> {
  console.log('Downloading video_stub.mp4..');
  const file = fs.createWriteStream(videoStubPath);
  return new Promise(resolve => {
    http.get(
      'http://www.mytvtestpatterns.com/mytvtestpatterns/Default/GetFile?p=PhilipsCircleMP4',
      response => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      },
    );
  });
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
    const dir = path.join(moviePath, `${name} (${year}).mp4`);
    fs.copyFileSync(videoStubPath, dir);
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
    if (!fs.existsSync(showDir)) {
      fs.mkdirSync(showDir);
    }

    for (let index = 0; index < seasons.length; index++) {
      const season = seasons[index];
      for (const episode of season) {
        const showPath = path.join(
          showDir,
          `/S${(index + 1).toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}.mp4`,
        );
        fs.copyFileSync(videoStubPath, showPath);
      }
    }
  }
}

export const requiredAudio = {
  Ladytron: {
    'Light & Magic': ['2 - Seventeen.mp3', '3 - Flicking Your Switch.mp3', '9 - Evil.mp3'],
    'Witching Hour': ['2 - Destroy Everything You Touch.mp3'],
  },
};

export async function prepareAudioDir(audioPath = audioDir): Promise<void> {
  for (const [artist, albums] of Object.entries(requiredAudio)) {
    const artistDir = path.join(audioPath, artist);
    if (!fs.existsSync(artistDir)) {
      fs.mkdirSync(artistDir);
    }

    for (const [album, songs] of Object.entries(albums)) {
      const albumDir = path.join(artistDir, album);
      if (!fs.existsSync(albumDir)) {
        fs.mkdirSync(albumDir);
      }

      for (const song of songs) {
        const songPath = path.join(albumDir, song);
        fs.copyFileSync(audioStubPath, songPath);
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

// if (!module.parent) {
//   createAll()
//     .then(() => process.exit(0))
//     .catch(err => {
//       console.error(err);
//       process.exit(1);
//     });
// }
