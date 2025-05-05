import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAccount } from '../test/test-client.js';

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

// is this file being run directly in esm mode?
const __filename = fileURLToPath(import.meta.url);
const mainModulePath = path.resolve(process.argv[1]);
if (__filename === mainModulePath) {
  cleanup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
