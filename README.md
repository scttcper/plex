# @ctrl/plex [![npm](https://badgen.net/npm/v/@ctrl/plex)](https://www.npmjs.com/package/@ctrl/plex)

> A TypeScript [Plex](https://www.plex.tv/) API client using [ofetch](https://github.com/unjs/ofetch) based on [pkkid/python-plexapi](https://github.com/pushingkarmaorg/python-plexapi)

### Install

```console
npm install @ctrl/plex
```

### Docs

https://ctrl-plex.vercel.app

### Use

Create a plex connection

```ts
import { MyPlexAccount } from '@ctrl/plex';

const account = await new MyPlexAccount('http://localhost:32400', 'username', 'password').connect();
const resource = await account.resource('<SERVERNAME>');
const plex = await resource.connect();
const library = await plex.library();
```

###### Example 1: List all unwatched movies.

```ts
import { MovieSection } from '@ctrl/plex';

// Pass MovieSection generic because the section title doesn't imply a section type.
const section = await library.section<MovieSection>('Movies');
// Get an array of Movie objects
const results = await section.search({ unwatched: true });
```

###### Example 2: Search for a list of movies containing a title

```ts
const library = await plex.library();
const section = await library.section<MovieSection>('Movies');
const results = await section.search({ title: 'Rush Hour' });
```

###### Example 3: List all content containing a specific query

```ts
const results = await plex.search('Arnold');
// Each hub represents a single Hub (or category) in the PlexServer search (movie, actor, etc)
for (const hub of results) {
  // Log first result in each category
  console.log(hub?.Metadata?.[0]);
}
```

###### Example 4: List all episodes of a tv show.

```ts
import { ShowSection } from '@ctrl/plex';

// Pass ShowSection generic because the section title doesn't imply a section type.
const section = await library.section<ShowSection>('TV Shows');
// Get an array of Show objects
const results = await section.search({ title: 'Silicon Valley' });
const episodes = await results[0].episodes();
```

### Differences from python plex client

JS is a different language and some methods of the api were not possible.
Chaining functions with requests must be awaited mostly individually. Constructors in JS don't typically make requests
and accessing properties normally cannot make requests either.

### Testing

Tests are run against a real instance of plex.

Setup test environment variables, create a plex account just for testing. Using a real account will break everything

```sh
export PLEX_USERNAME=email
export PLEX_PASSWORD=password
```

Setup test content (once)

```sh
pnpm run add-media
```

Run tests

```sh
pnpm test
```

Post testing, remove plex server from account. Warning this is destructive. Do not use this on a real plex account.

```sh
pnpm run test-cleanup
```

### Running tests locally

#### Step 1

get a claim token from https://www.plex.tv/claim/
export PLEX_CLAIM_TOKEN=claim-token

Start plex container for testing. Replace `/Users/scooper/gh/plex` with the path to this repo's directory.

#### Step 2
Replace `/Users/scooper/gh/plex` with the path to this repo's directory.

```console
docker run -d \
  --name=plex \
  --net=host \
  -h orbstack \
  -p 32400:32400/tcp \
  -p 32400:32400 \
  -p 1900:1900/udp \
  -p 5353:5353/udp \
  -p 8324:8324 \
  -p 32410:32410/udp \
  -p 32412:32412/udp \
  -p 32413:32413/udp \
  -p 32414:32414/udp \
  -p 32469:32469 \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Etc/UTC \
  -e VERSION=docker \
  -e PLEX_CLAIM=$PLEX_CLAIM_TOKEN \
  -v /Users/scooper/gh/plex/plex/media/db:/config \
  -v /Users/scooper/gh/plex/plex/media/transcode:/transcode \
  -v /Users/scooper/gh/plex/plex/media:/data \
  --restart unless-stopped \
  lscr.io/linuxserver/plex:latest
```

Pull latest plex container if needed

```console
docker pull lscr.io/linuxserver/plex:latest
```

bootstrap plex server with test media. This assumes you have set the `PLEX_PASSWORD` and `PLEX_USERNAME` environment variables.

```console
npx tsx scripts/bootstraptest.ts --no-docker --server-name=orbstack --password=$PLEX_PASSWORD --username=$PLEX_USERNAME
```
