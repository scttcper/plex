/**
 * A simple script that compares the resolution of plex duplicate movies
 */
import { filenameParse, type ParsedMovie } from '@ctrl/video-filename-parser';

import { type MovieSection, MyPlexAccount } from '../src/index.js';

/**
 * The name of the resource to use.
 */
const RESOURCE_NAME = 'cooper-plex';
const SECTION_NAME = 'Movies';

interface ParsedFile {
  path: string;
  filename: string;
  parsed: ParsedMovie;
  qualityScore: number;
}

interface DuplicateMovie {
  title: string;
  year: number;
  locations: string[];
  parsedFiles: ParsedFile[];
  filesToRemove: string[];
  foldersToRemove: string[];
  sameQuality: boolean;
}

// Quick and dirty resolution scoring - extract number from enum string
function getQualityScore(parsed: ParsedMovie): number {
  if (!parsed.resolution) {
    return 0;
  }

  // Extract resolution number from enum string (e.g., "R1080P" -> 1080)
  const resolutionMatch = /\d+/.exec(parsed.resolution);
  return resolutionMatch ? parseInt(resolutionMatch[0], 10) : 0;
}

async function listDuplicateMovies() {
  const account = await new MyPlexAccount({
    baseUrl: null,
    username: process.env.PLEX_USERNAME,
    password: process.env.PLEX_PASSWORD,
    token: process.env.PLEX_TOKEN,
  }).connect();
  const resource = await account.resource(RESOURCE_NAME);
  const plex = await resource.connect();
  const library = await plex.library();
  const movieSection = await library.section<MovieSection>(SECTION_NAME);
  const movies = await movieSection.search({ duplicate: 1 });

  const duplicateMovies: DuplicateMovie[] = [];

  for (const movie of movies) {
    await movie.reload();
    const locations: string[] = await movie.locations();

    // A movie has duplicates if it has more than one file location
    if (locations.length > 1) {
      // Parse each file to determine quality
      const parsedFiles: ParsedFile[] = locations.map(location => {
        const filename = location.split('/').pop() || location;
        const parsed = filenameParse(filename);
        const qualityScore = getQualityScore(parsed);

        return {
          path: location,
          filename,
          parsed,
          qualityScore,
        };
      });

      // Sort by quality score (highest first)
      parsedFiles.sort((a, b) => b.qualityScore - a.qualityScore);

      // Check if all files have the same quality score
      const sameQuality = parsedFiles.every(
        file => file.qualityScore === parsedFiles[0].qualityScore,
      );

      // Keep the highest quality file, mark others for removal
      const filesToRemove = parsedFiles.slice(1).map(file => file.path);

      // Extract parent directories from files to remove
      const foldersToRemove = filesToRemove
        .map(filePath => {
          const pathParts = filePath.split('/');
          // Remove the filename to get the parent directory
          pathParts.pop();
          return pathParts.join('/');
        })
        .filter((folder, index, arr) => arr.indexOf(folder) === index); // Remove duplicates

      duplicateMovies.push({
        title: movie.title,
        year: movie.year,
        locations,
        parsedFiles,
        filesToRemove,
        foldersToRemove,
        sameQuality,
      });
    }
  }

  if (duplicateMovies.length === 0) {
    console.log('No duplicate movies found.');
    return;
  }

  console.log(`Found ${duplicateMovies.length} movies with duplicates:\n`);

  for (const movie of duplicateMovies) {
    console.log('---');
    console.log(`${movie.title} (${movie.year})`);
    console.log(`${movie.locations.length} copies found:`);

    if (movie.sameQuality) {
      console.log('⚠️  All copies have the same quality score\n');
    } else {
      console.log();
    }

    // Show quality analysis for each file
    movie.parsedFiles.forEach((file, index) => {
      let status: string;
      if (movie.sameQuality) {
        status = index === 0 ? '✅ KEEP (first found)' : '⚠️  SAME QUALITY';
      } else {
        status = index === 0 ? '✅ KEEP' : '❌ REMOVE';
      }
      console.log(`  ${status} [Score: ${file.qualityScore}] ${file.filename}`);

      if (file.parsed.resolution) {
        console.log(`    📺 Resolution: ${file.parsed.resolution}`);
      }
      if (file.parsed.sources?.length > 0) {
        console.log(`    💿 Source: ${file.parsed.sources.join(', ')}`);
      }
      if (file.parsed.videoCodec) {
        console.log(`    🎬 Codec: ${file.parsed.videoCodec}`);
      }
      console.log(`    📁 Path: ${file.path}`);
      console.log();
    });
  }

  // Summary of folders to remove (exclude movies with same quality)
  console.log('\n🗑️  FOLDERS RECOMMENDED FOR REMOVAL:');
  console.log('======================================');
  const totalFoldersToRemove = duplicateMovies
    .filter(movie => !movie.sameQuality)
    .reduce((total, movie) => total + movie.foldersToRemove.length, 0);

  for (const movie of duplicateMovies) {
    if (!movie.sameQuality && movie.foldersToRemove.length > 0) {
      console.log(`\n${movie.title} (${movie.year}):`);
      for (const folderPath of movie.foldersToRemove) {
        console.log(`  rm -rf "${folderPath}"`);
      }
    }
  }

  console.log(`\nTotal folders recommended for removal: ${totalFoldersToRemove}`);
}

listDuplicateMovies().then(() => console.log('done'));
