/* eslint-disable no-await-in-loop */
import { MyPlexAccount, PlexServer, X_PLEX_IDENTIFIER } from '../src';

async function main() {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const token = process.env.PLEX_TOKEN || process.env.PLEXAPI_AUTH_SERVER_TOKEN!;
  const account = await new MyPlexAccount(
    'http://localhost:32400',
    undefined,
    undefined,
    token,
  ).connect();
  const plex = new PlexServer('http://localhost:32400', token);

  const devices = await account.devices();
  for (const device of devices) {
    if (device.clientIdentifier === plex.machineIdentifier) {
      console.log(`Removing device "${device.name}", with id "${device.clientIdentifier}"`);
      await device.delete();
    } else if (device.clientIdentifier === X_PLEX_IDENTIFIER) {
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
