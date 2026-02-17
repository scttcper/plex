export interface ActivityData {
  uuid: string;
  type: string;
  cancellable: boolean;
  userID: number;
  title: string;
  subtitle: string;
  progress: number;
  Context?: {
    key?: string;
    [key: string]: any;
  };
}

export interface ButlerTaskData {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  interval: number;
  scheduleRandomized: boolean;
}

export interface SystemAccountData {
  id: number;
  key: string;
  name: string;
  thumb: string;
  autoSelectAudio: boolean;
  defaultAudioLanguage: string;
  defaultSubtitleLanguage: string;
  subtitleMode: number;
}

export interface SystemDeviceData {
  id: number;
  name: string;
  clientIdentifier: string;
  createdAt: number;
  platform: string;
}

export interface StatisticsBandwidthData {
  accountID: number;
  at: number;
  bytes: number;
  deviceID: number;
  lan: boolean;
  timespan: number;
}

export interface StatisticsResourcesData {
  at: number;
  hostCpuUtilization: number;
  hostMemoryUtilization: number;
  processCpuUtilization: number;
  processMemoryUtilization: number;
  timespan: number;
}
