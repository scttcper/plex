import { MyPlexAccount } from '../src/myplex';

async function setup(): Promise<void> {
  const account = await new MyPlexAccount(
    process.env.PLEX_USERNAME,
    process.env.PLEX_PASSWORD,
  ).connect();
  const claimToken = await account.claimToken();
  // https://help.github.com/en/actions/reference/workflow-commands-for-github-actions#setting-an-environment-variable
  console.log(`::set-output name=PLEX_CLAIM::${claimToken}`);
}

setup();
