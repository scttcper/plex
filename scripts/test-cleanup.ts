import { createAccount } from '../test/test-client.js';

async function cleanup(): Promise<void> {
  const account = await createAccount();
  const resources = await account.resources();
  console.log(`${resources.length} servers found`);
  for (const resource of resources) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await resource.delete();
    } catch {
      // pass
    }
  }
}

if (!module.parent) {
  cleanup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
