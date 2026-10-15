import { PlexServer, X_PLEX_IDENTIFIER } from '../src/index.ts';

async function main() {
  const token = process.env.PLEX_TOKEN || process.env.PLEXAPI_AUTH_SERVER_TOKEN;
  if (!token) {
    throw new Error('Set PLEX_TOKEN or PLEXAPI_AUTH_SERVER_TOKEN to tear down the test server.');
  }
  const plex = new PlexServer('http://localhost:32400', token);

  const devices = await plex.myPlexAccount().devices();
  console.log(`${devices.length} devices exist`);
  for (const device of devices) {
    if (!device.name) {
      // Device is not connectable?
      continue;
    }

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

await main();
process.exit(0);
