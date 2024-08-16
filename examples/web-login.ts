import { MyPlexAccount } from '../src/index.js';

async function listLibraries(account: MyPlexAccount) {
  const resource = await account.resource('zeus');
  const plex = await resource.connect();
  const library = await plex.library();
  const sections = await library.sections();

  for (const section of sections) {
    console.log(`${section.title} - ${section.CONTENT_TYPE}`);
  }
}

MyPlexAccount.getWebLogin().then(webLogin => {
  console.log('Got to', webLogin.uri);
  MyPlexAccount.webLoginCheck(webLogin).then(account =>
    listLibraries(account).then(() => console.log('done')),
  );
});
