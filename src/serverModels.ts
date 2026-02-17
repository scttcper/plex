import { PlexObject } from './base/plexObject.js';
import type {
  ActivityData,
  ButlerTaskData,
  StatisticsBandwidthData,
  StatisticsResourcesData,
  SystemAccountData,
  SystemDeviceData,
} from './serverModels.types.js';

/**
 * Represents a currently running activity on the Plex server.
 */
export class Activity extends PlexObject {
  static override TAG = 'Activity';

  declare uuid: string;
  declare type: string;
  declare cancellable: boolean;
  declare userID: number;
  declare title: string;
  declare subtitle: string;
  declare progress: number;

  /** Cancel the activity. */
  async cancel(): Promise<void> {
    const key = `/activities/${this.uuid}`;
    await this.server.query({ path: key, method: 'delete' });
  }

  protected _loadData(data: ActivityData): void {
    this.uuid = data.uuid;
    this.key = `/activities/${data.uuid}`;
    this.type = data.type;
    this.cancellable = data.cancellable;
    this.userID = data.userID;
    this.title = data.title;
    this.subtitle = data.subtitle;
    this.progress = data.progress;
  }
}

/**
 * Represents a scheduled butler (maintenance) task on the Plex server.
 */
export class ButlerTask extends PlexObject {
  static override TAG = 'ButlerTask';

  declare name: string;
  declare title: string;
  declare description: string;
  declare enabled: boolean;
  declare interval: number;
  declare scheduleRandomized: boolean;

  protected _loadData(data: ButlerTaskData): void {
    this.name = data.name;
    this.key = data.name;
    this.title = data.title;
    this.description = data.description;
    this.enabled = data.enabled;
    this.interval = data.interval;
    this.scheduleRandomized = data.scheduleRandomized;
  }
}

/**
 * Represents a system account on the Plex server.
 */
export class SystemAccount extends PlexObject {
  static override TAG = 'Account';

  declare accountID: number;
  declare accountName: string;
  declare thumb: string;
  declare autoSelectAudio: boolean;
  declare defaultAudioLanguage: string;
  declare defaultSubtitleLanguage: string;
  declare subtitleMode: number;

  protected _loadData(data: SystemAccountData): void {
    this.accountID = data.id;
    this.key = data.key ?? `/accounts/${data.id}`;
    this.accountName = data.name;
    this.thumb = data.thumb;
    this.autoSelectAudio = data.autoSelectAudio;
    this.defaultAudioLanguage = data.defaultAudioLanguage;
    this.defaultSubtitleLanguage = data.defaultSubtitleLanguage;
    this.subtitleMode = data.subtitleMode;
  }
}

/**
 * Represents a system device on the Plex server.
 */
export class SystemDevice extends PlexObject {
  static override TAG = 'Device';

  declare deviceID: number;
  declare name: string;
  declare clientIdentifier: string;
  declare createdAt: Date;
  declare platform: string;

  protected _loadData(data: SystemDeviceData): void {
    this.deviceID = data.id;
    this.key = `/devices/${data.id}`;
    this.name = data.name;
    this.clientIdentifier = data.clientIdentifier;
    this.createdAt = new Date(data.createdAt * 1000);
    this.platform = data.platform;
  }
}

/**
 * Represents bandwidth statistics from the Plex server dashboard.
 */
export class StatisticsBandwidth extends PlexObject {
  static override TAG = 'StatisticsBandwidth';

  declare accountID: number;
  declare at: Date;
  declare bytes: number;
  declare deviceID: number;
  declare lan: boolean;
  declare timespan: number;

  protected _loadData(data: StatisticsBandwidthData): void {
    this.key = '';
    this.accountID = data.accountID;
    this.at = new Date(data.at * 1000);
    this.bytes = data.bytes;
    this.deviceID = data.deviceID;
    this.lan = data.lan;
    this.timespan = data.timespan;
  }
}

/**
 * Represents resource usage statistics from the Plex server.
 */
export class StatisticsResources extends PlexObject {
  static override TAG = 'StatisticsResources';

  declare at: Date;
  declare hostCpuUtilization: number;
  declare hostMemoryUtilization: number;
  declare processCpuUtilization: number;
  declare processMemoryUtilization: number;
  declare timespan: number;

  protected _loadData(data: StatisticsResourcesData): void {
    this.key = '';
    this.at = new Date(data.at * 1000);
    this.hostCpuUtilization = data.hostCpuUtilization;
    this.hostMemoryUtilization = data.hostMemoryUtilization;
    this.processCpuUtilization = data.processCpuUtilization;
    this.processMemoryUtilization = data.processMemoryUtilization;
    this.timespan = data.timespan;
  }
}
