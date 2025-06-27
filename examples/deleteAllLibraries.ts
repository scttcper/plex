import type { PlexServer } from '../src/index.js';
import { createClient } from '../test/test-client.js';

async function main() {
  console.log('Connecting to Plex server...');
  let plex: PlexServer;
  try {
    plex = await createClient();
    console.log(`Connected to server: ${plex.friendlyName}`);
  } catch (err) {
    console.error('Failed to connect to Plex server:', err);
    process.exit(1);
  }

  console.log('Fetching library sections...');
  try {
    const library = await plex.library();
    const sections = await library.sections();

    if (sections.length === 0) {
      console.log('No library sections found to delete.');
      return;
    }

    console.log(`Found ${sections.length} sections to delete:`);
    sections.forEach(section =>
      console.log(`- ${section.title} (Type: ${section.type}, Key: ${section.key})`),
    );

    console.log('Deleting all sections...');
    for (const section of sections) {
      try {
        await section.delete();
        console.log(`Deleted section: ${section.title}`);
      } catch (err) {
        console.error(`Failed to delete section ${section.title} (Key: ${section.key}):`, err);
      }
    }

    console.log('Finished deleting all library sections.');
  } catch (err) {
    console.error('An error occurred while deleting libraries:', err);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('Finished deleting all library sections.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Unhandled error in main function:', err);
    process.exit(1);
  });
