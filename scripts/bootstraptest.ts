/* eslint-disable no-await-in-loop */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import delay from 'delay';
import execa from 'execa';
import globby from 'globby';
import makeDir from 'make-dir';
import ora from 'ora';
import pRetry from 'p-retry';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { MyPlexAccount, PlexServer } from '../src';
import { AlertListener } from '../src/alert';
import { AlertTypes } from '../src/alert.types';

import { prepareMovieDir, prepareTvDir, requiredMovies, requiredShows } from './create-media';

const yarg = yargs(hideBin(process.argv))
  .option('token', { type: 'string', desc: 'plex account token', default: '' })
  .option('username', { type: 'string', desc: 'plex account username', default: '' })
  .option('password', { type: 'string', desc: 'plex account password', default: '' })
  .option('destination', {
    type: 'string',
    desc: 'Local path where to store all the media',
    default: 'plex',
  })
  .option('advertise-ip', {
    type: 'string',
    default: '127.0.0.1',
    desc: 'IP address which should be advertised by new Plex instance',
  })
  .option('server-name', {
    type: 'string',
    default: `plex-test-docker-${randomUUID()}`,
    desc: 'Name for the new server',
  })
  .option('docker-tag', {
    type: 'string',
    default: 'latest',
    desc: 'Docker image tag to install',
  })
  .option('docker', {
    type: 'boolean',
    desc: 'Use docker',
    default: true,
  })
  .option('accept-eula', {
    type: 'boolean',
    desc: 'Accept Plex`s EULA',
    default: false,
  })
  .option('create-movies', {
    type: 'boolean',
    desc: 'Create Movies section',
    default: true,
  })
  .option('create-shows', {
    type: 'boolean',
    desc: 'Create Shows section',
    default: true,
  });

const dockerCmd = ({
  imageTag,
  claimToken,
  advertiseIp,
  containerNameExtra,
  timezone,
  language,
  hostname,
  destination,
}: Options) => [
  // 'docker',
  'run',
  '-d',
  '--name',
  `plex-test-${containerNameExtra}${imageTag}`,
  '--restart',
  'on-failure',
  '-p',
  '32400:32400/tcp',
  '-p',
  '3005:3005/tcp',
  '-p',
  '8324:8324/tcp',
  '-p',
  '32469:32469/tcp',
  '-p',
  '1900:1900/udp',
  '-p',
  '32410:32410/udp',
  '-p',
  '32412:32412/udp',
  '-p',
  '32413:32413/udp',
  '-p',
  '32414:32414/udp',
  '-e',
  `PLEX_CLAIM=${claimToken}`,
  '-e',
  `ADVERTISE_IP=http://${advertiseIp}:32400/`,
  '-e',
  `TZ=${timezone}`,
  '-e',
  `LANG=${language}`,
  '-h',
  hostname,
  '-v',
  `${destination}/db:/config`,
  '-v',
  `${destination}/transcode:/transcode`,
  '-v',
  `${destination}/media:/data`,
  `plexinc/pms-docker:${imageTag}`,
];

type Section = {
  name: string;
  type: string;
  location: string;
  agent: string;
  scanner: string;
  language: string;
  expectedMediaCount: number;
};

// const x = {
//   destination: '/Users/scooper/gh/python-plexapi/plex',
//   hostname: 'plex-test-docker-042ed3f6-901b-44de-a491-18f92c66a799',
//   claim_token: 'claim-ti5xUu4NKWn6uKzJpS91',
//   timezone: 'UTC',
//   language: 'en_US.UTF-8',
//   advertise_ip: '127.0.0.1',
//   image_tag: 'something',
//   container_name_extra: '',
// };

type Options = {
  destination: string;
  hostname: string;
  claimToken: string;
  timezone: string;
  language: string;
  advertiseIp: string;
  imageTag: string;
  containerNameExtra: string;
};

async function createSection(section: Section, server: PlexServer): Promise<void> {
  let processedMedia = 0;
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async resolve => {
    const alertCallback = (data: AlertTypes) => {
      if (data.type === 'timeline' && data.TimelineEntry[0].state === 5) {
        processedMedia += 1;
        // console.log(`Finished ${processedMedia} ${section.name}`);
      }

      if (processedMedia === section.expectedMediaCount) {
        resolve();
      }
    };

    const listener = new AlertListener(server, alertCallback);
    await listener.run();

    await delay(4000);

    try {
      // Add the specified section to our Plex instance. This tends to be a bit
      // flaky, so we retry a few times here.
      await pRetry(
        async () => {
          const library = await server.library();
          await library.add(
            section.name,
            section.type,
            section.agent,
            section.scanner,
            section.location,
            section.language,
          );
        },
        {
          retries: 60,
          onFailedAttempt: async () => delay(1000),
        },
      );
    } catch {
      throw new Error('Unable to create section');
    }
  });
}

async function setupMovies(moviePath: string): Promise<number> {
  await makeDir(moviePath);
  const files = await globby(`${moviePath}/*.mkv`);
  const totalMovies = Object.keys(requiredMovies).length;
  if (files.length === totalMovies) {
    return totalMovies;
  }

  await prepareMovieDir(moviePath);
  return totalMovies;
}

async function setupShows(showPath: string): Promise<number> {
  await makeDir(showPath);
  const files = await globby(`${showPath}/*.mkv`);
  const totalEpisodes = Object.values(requiredShows).flat(2).length;

  if (files.length === totalEpisodes) {
    return totalEpisodes;
  }

  await prepareTvDir(showPath);
  return totalEpisodes;
}

async function main() {
  const argv = await Promise.resolve(yarg.argv);
  const token = argv.token || process.env.PLEXAPI_AUTH_SERVER_TOKEN;
  const { username, password } = argv;
  if (!username && !password && !token) {
    throw new Error('Must provider username/password or token');
  }

  const account = await new MyPlexAccount(
    'http://localhost:32400',
    argv.username,
    argv.password,
    token,
  ).connect();
  const claimToken = await account.claimToken();
  const destination = join(__dirname, '..', argv.destination);
  console.log({
    __dirname,
    destination,
  });

  const opts: Options = {
    destination,
    hostname: argv['server-name'],
    claimToken,
    timezone: 'UTC',
    language: 'en_US.UTF-8',
    advertiseIp: argv['advertise-ip'],
    imageTag: argv['docker-tag'],
    containerNameExtra: '',
  };

  if (argv.docker) {
    try {
      await execa('which', ['docker']);
    } catch {
      throw new Error('Docker is required to be available');
    }

    try {
      await execa('docker', ['pull', `plexinc/pms-docker:${opts.imageTag}`]);
    } catch {
      throw new Error('Got an error when executing docker pull!');
    }

    const cmd = dockerCmd(opts);

    try {
      await execa('docker', cmd);
    } catch (err: any) {
      console.error(err.stderr);
      throw new Error('docker command failed');
    }
  }

  await account.connect();

  const connectServer = async () => {
    return (await account.device(opts.hostname)).connect();
  };

  const waitServer = ora('Waiting for the server to appear in your account').start();

  let plexServer: PlexServer;
  try {
    plexServer = await pRetry(connectServer, {
      retries: 20,
      onFailedAttempt: async () => delay(1000),
    });
  } catch {
    throw new Error('Server didnt appear in your account');
  }

  waitServer.succeed();

  const settingsProg = ora('Setting server test settings').start();
  const settings = await plexServer.settings();
  if (argv['accept-eula']) {
    settings.get('acceptedEULA').set(true);
  }

  if (account.subscriptionActive) {
    settings.get('GenerateIntroMarkerBehavior').set('never');
  }

  settings.get('GenerateBIFBehavior').set('never');
  settings.get('GenerateChapterThumbBehavior').set('never');
  settings.get('LoudnessAnalysisBehavior').set('never');

  await settings.save();
  settingsProg.succeed();

  const mediaPath = join(opts.destination, 'media');
  const sections: Section[] = [];

  if (argv['create-movies']) {
    const moviesPath = join(mediaPath, 'Movies');
    const setupMoviesProgress = ora(`Setup movie files`).start();
    const numMovies = await setupMovies(moviesPath);
    setupMoviesProgress.succeed();
    sections.push({
      name: 'Movies',
      type: 'movie',
      location: '/data/Movies',
      agent: 'tv.plex.agents.movie',
      scanner: 'Plex Movie',
      language: 'en-US',
      expectedMediaCount: numMovies,
    });
  }

  if (argv['create-shows']) {
    const showsPath = join(mediaPath, 'TV-Shows');
    const setupMoviesProgress = ora(`Setup movie files`).start();
    const numMovies = await setupShows(showsPath);
    setupMoviesProgress.succeed();
    sections.push({
      name: 'TV Shows',
      type: 'show',
      location: '/data/TV-Shows',
      agent: 'tv.plex.agents.series',
      scanner: 'Plex TV Series',
      language: 'en-US',
      expectedMediaCount: numMovies,
    });
  }

  for (const section of sections) {
    const sectionProgress = ora(`Setup section ${section.name}`).start();
    await createSection(section, plexServer);
    sectionProgress.succeed();
  }

  // const path = join(__dirname, argv.destination);
  //   const         arg_bindings = {
  //     "destination": path,
  //     "hostname": opts.server_name,
  //     "claim_token": account.claimToken() if account else "",
  //     "timezone": opts.timezone,
  //     "language": opts.language,
  //     "advertise_ip": opts.advertise_ip,
  //     "image_tag": opts.docker_tag,
  //     "container_name_extra": "" if account else "unclaimed-",
  // }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
