export interface Player {
  machineIdentifier: string;
  deviceClass: string;
  platform: string;
  platformVersion: string;
  product: string;
  protocol: string;
  protocolCapabilities: string;
  protocolVersion: string;
  title: string;
  version: string;
}

export interface SendCommandParams {
  [key: string]: string | number | boolean | undefined;
}

export interface ClientTimelineData {
  type: string;
  state: string;
  time?: number;
  duration?: number;
  seekRange?: string;
  key?: string;
  ratingKey?: string;
  volume?: number;
  shuffle?: boolean;
  repeat?: number;
  playQueueID?: number;
  playQueueItemID?: number;
  controllable?: string;
  machineIdentifier?: string;
  providerIdentifier?: string;
  containerKey?: string;
  address?: string;
  port?: number;
  protocol?: string;
}

export interface SetParametersOptions {
  volume?: number;
  shuffle?: boolean | number;
  repeat?: number;
  mtype?: string;
}

export interface SetStreamsOptions {
  audioStreamID?: number;
  subtitleStreamID?: number;
  videoStreamID?: number;
  mtype?: string;
}

export interface PlayMediaOptions {
  offset?: number;
  params?: Record<string, string | number>;
}
