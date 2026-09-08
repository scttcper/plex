import type {
  AccountQueryOptions,
  DiscoveryEntry,
  DownloadOptions,
  MediaDownload,
  MetadataFieldUpdates,
  MetadataTagEditOptions,
  Movie,
  MyPlexAccount,
  PlexServer,
  StreamUrlOptions,
  discover,
} from '../src/index.ts';

// Compiled by the build; never executed. These checks exercise the public barrel.
export async function publicApiTypes(
  account: MyPlexAccount,
  movie: Movie,
  server: PlexServer,
): Promise<void> {
  const text: string = await account.query({ url: 'https://plex.tv/:/ip', responseType: 'text' });
  const query: AccountQueryOptions = { url: 'https://plex.tv/api/v2/ping' };
  const structured: { pong: boolean } = await account.query<{ pong: boolean }>(query);
  const legacyResponse: { pong: boolean } = await account.query(query);
  const unknownResponse = await account.query<unknown>(query);
  // @ts-expect-error Explicitly unknown responses require narrowing.
  const unchecked: { pong: boolean } = unknownResponse;
  // @ts-expect-error Text response types cannot be overridden with an unrelated shape.
  await account.query<{ pong: boolean }>({ ...query, responseType: 'text' });
  const fields: MetadataFieldUpdates = { title: text, userRating: 0, addedAt: new Date() };
  await movie.editFields(fields);
  // @ts-expect-error A rating must be numeric.
  await movie.editFields({ userRating: '5' });
  // @ts-expect-error Known metadata fields are checked; custom fields use edit().
  await movie.editFields({ unknownField: 'value' });
  const tags: MetadataTagEditOptions = { tag: 'pluginTag', items: ['value'] as const };
  await movie.editTags(tags);
  const stream: StreamUrlOptions = {
    protocol: 'dash',
    partIndex: 1,
    directPlay: false,
    pluginOption: 'value',
  };
  const body: ReadableStream<Uint8Array> = await server.stream(movie.getStreamURL(stream));
  const options: DownloadOptions = { signal: new AbortController().signal, allVersions: true };
  const downloads: AsyncGenerator<MediaDownload, void> = movie.download(options);
  // @ts-expect-error Stream option values must be scalar.
  movie.getStreamURL({ protocol: ['dash'] });
  const discovery: Awaited<ReturnType<typeof discover>> = [] satisfies DiscoveryEntry[];
  void [structured, legacyResponse, unchecked, body, downloads, discovery];
}
