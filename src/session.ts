import { Track } from './audio.ts';
import { createPlexItem, type HydratedPlexItem } from './itemFactory.ts';
import { Photo } from './photo.ts';
import type {
  PlexPlaybackSession,
  PlexPlaybackSessionData,
  PlexSessionItem,
  PlexSessionMetadataData,
  PlexSessionPlayer,
  PlexSessionPlayerData,
  PlexSessionUser,
  PlexSessionUserData,
  PlexTranscodeSession,
  PlexTranscodeSessionData,
} from './session.types.ts';
import { parsePlexBoolean, type PlexBoolean } from './util.ts';
import { Clip, Episode, Movie } from './video.ts';

type SessionServer = Parameters<typeof createPlexItem>[0];
type SessionMedia = Clip | Episode | Movie | Photo | Track;

function isSessionMedia(item: HydratedPlexItem): item is SessionMedia {
  return (
    item instanceof Clip ||
    item instanceof Episode ||
    item instanceof Movie ||
    item instanceof Photo ||
    item instanceof Track
  );
}

function sessionInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError(`Plex returned an invalid ${field}: ${value}`);
  }
  return parsed;
}

function optionalPlexBoolean(value: PlexBoolean | undefined): boolean | undefined {
  return value === undefined ? undefined : parsePlexBoolean(value);
}

function createSessionUser(data: PlexSessionUserData): PlexSessionUser {
  return {
    id: sessionInteger(data.id, 'session user ID'),
    thumb: data.thumb,
    title: data.title,
  };
}

function createSessionPlayer(data: PlexSessionPlayerData): PlexSessionPlayer {
  return {
    address: data.address,
    device: data.device,
    local: optionalPlexBoolean(data.local),
    machineIdentifier: data.machineIdentifier,
    model: data.model,
    platform: data.platform,
    platformVersion: data.platformVersion,
    product: data.product,
    profile: data.profile,
    relayed: optionalPlexBoolean(data.relayed),
    remotePublicAddress: data.remotePublicAddress,
    secure: optionalPlexBoolean(data.secure),
    state: data.state,
    title: data.title,
    userId: data.userID,
    version: data.version,
  };
}

function createPlaybackSession(data: PlexPlaybackSessionData): PlexPlaybackSession {
  return {
    bandwidth: data.bandwidth,
    id: data.id,
    location: data.location,
  };
}

export function createPlexTranscodeSession(data: PlexTranscodeSessionData): PlexTranscodeSession {
  return {
    audioChannels: data.audioChannels,
    audioCodec: data.audioCodec,
    audioDecision: data.audioDecision,
    complete: parsePlexBoolean(data.complete),
    container: data.container,
    context: data.context,
    duration: data.duration,
    error: parsePlexBoolean(data.error),
    hardwareDecoding: data.transcodeHwDecoding,
    hardwareDecodingTitle: data.transcodeHwDecodingTitle,
    hardwareEncoding: data.transcodeHwEncoding,
    hardwareEncodingTitle: data.transcodeHwEncodingTitle,
    hardwareFullPipeline: optionalPlexBoolean(data.transcodeHwFullPipeline),
    hardwareRequested: optionalPlexBoolean(data.transcodeHwRequested),
    height: data.height,
    id: data.key,
    maxOffsetAvailable: data.maxOffsetAvailable,
    minOffsetAvailable: data.minOffsetAvailable,
    progress: data.progress,
    protocol: data.protocol,
    remaining: data.remaining,
    size: data.size,
    sourceAudioCodec: data.sourceAudioCodec,
    sourceVideoCodec: data.sourceVideoCodec,
    speed: data.speed,
    startedAt: data.timeStamp === undefined ? undefined : new Date(data.timeStamp * 1000),
    subtitleDecision: data.subtitleDecision,
    throttled: parsePlexBoolean(data.throttled),
    videoCodec: data.videoCodec,
    videoDecision: data.videoDecision,
    width: data.width,
  };
}

export function createPlexSessionItem(
  server: SessionServer,
  data: PlexSessionMetadataData,
): PlexSessionItem {
  const item = createPlexItem(server, data);
  if (!isSessionMedia(item)) {
    throw new Error(`Unsupported Plex session type: ${data.type}`);
  }

  return Object.assign(item, {
    live: parsePlexBoolean(data.live),
    player: createSessionPlayer(data.Player),
    session: data.Session ? createPlaybackSession(data.Session) : undefined,
    sessionKey: sessionInteger(data.sessionKey, 'session key'),
    transcodeSession: data.TranscodeSession
      ? createPlexTranscodeSession(data.TranscodeSession)
      : undefined,
    user: createSessionUser(data.User),
  });
}
