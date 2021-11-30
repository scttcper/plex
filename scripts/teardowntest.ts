/* eslint-disable no-await-in-loop */
import { PlexServer, X_PLEX_IDENTIFIER } from '../src';

async function main() {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const token = process.env.PLEX_TOKEN || process.env.PLEXAPI_AUTH_SERVER_TOKEN!;
  const plex = new PlexServer('http://localhost:32400', token);

  const devices = await plex.myPlexAccount().devices();
  console.log(`${devices.length} devices exist`);
  for (const device of devices) {
    if (device.name.startsWith('plex-test-docker')) {
      console.log(`Removing device "${device.name}", with id "${device.clientIdentifier}"`);
      await device.delete();
      continue;
    }

    if (device.clientIdentifier === plex.machineIdentifier) {
      console.log(`Removing device "${device.name}", with id "${device.clientIdentifier}"`);
      await device.delete();
      continue;
    }
  }

  // If we remove the client first we wouldn't be able to authenticate to delete the server
  for (const device of devices) {
    if (device.clientIdentifier === X_PLEX_IDENTIFIER) {
      console.log(`Removing device "${device.name}", with id "${device.clientIdentifier}"`);
      await device.delete();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
