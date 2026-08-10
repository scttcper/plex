import { MyPlexAccount, MyPlexPinLogin } from '../src/index.ts';

async function listLibraries(account: MyPlexAccount) {
  const resource = await account.resource('zeus');
  const plex = await resource.connect();
  const library = await plex.library();
  const sections = await library.sections();

  for (const section of sections) {
    console.log(`${section.title} - ${section.CONTENT_TYPE}`);
  }
}

const login = await MyPlexPinLogin.create({ mode: 'oauth' });
console.log('Go to', login.oauthUrl());

const authentication = await login.wait();
const account = await new MyPlexAccount({ token: authentication.token }).connect();
await listLibraries(account);
