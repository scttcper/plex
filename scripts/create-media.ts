import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
const mediaDir = path.join(__dirname, '../media/');
const moviesDir = path.join(mediaDir, './movies/');
const tvDir = path.join(mediaDir, './shows/');
const videoStubPath = path.join(__dirname, '../test/data/video_stub.mp4');

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

export async function createAll(): Promise<void> {
  await downloadVideoFile();
  await prepareMovieDir();
  await prepareTvDir();
}

// if (!module.parent) {
//   createAll()
//     .then(() => process.exit(0))
//     .catch(err => {
//       console.error(err);
//       process.exit(1);
//     });
// }
