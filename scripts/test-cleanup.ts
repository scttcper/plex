import { createAccount } from '../test/test-client.ts';

async function cleanup(): Promise<void> {
  const account = await createAccount();
  const resources = await account.resources();
  console.log(`${resources.length} servers found`);
  for (const resource of resources) {
    try {
      await resource.delete();
    } catch {
      // pass
    }
  }
}

if (import.meta.main) {
  await cleanup();
  process.exit(0);
}
