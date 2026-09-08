import type { SettingResponse } from './settings.ts';

export interface NotificationContainer<T> {
  NotificationContainer: T;
}

export interface ActivityNotification {
  type: 'activity';
  size: number;
  ActivityNotification: Array<{
    event: string;
    uuid: string;
    /** Activity details when supplied by the server. */
    Activity?: {
      uuid: string;
      /** Server-defined activity, for example library.update.section. */
      type: string;
      cancellable: boolean;
      userID?: number;
      title: string;
      subtitle: string;
      progress: number;
    };
  }>;
}

export interface StatusNotification {
  type: 'status';
  size: number;
  StatusNotification: Array<{
    title: string;
    description: string;
    notificationName: string;
  }>;
}

export interface TimelineNotification {
  type: 'timeline';
  size: number;
  TimelineEntry: Array<{
    /** eg com.plexapp.plugins.library */
    identifier: string;
    sectionID: string;
    itemID: string;
    type: number;
    title: string;
    state: number;
    updatedAt: number;
  }>;
}

export interface ReachabilityNotification {
  type: 'reachability';
  size: number;
  ReachabilityNotification: Array<{
    reachability: boolean;
  }>;
}

export interface BackgroundProcessingQueueEventNotification {
  type: 'backgroundProcessingQueue';
  size: number;
  BackgroundProcessingQueueEventNotification: Array<{
    queueID: number;
    /** Server-defined queue event, for example queueRegenerated. */
    event: string;
  }>;
}

export interface PreferenceNotification {
  type: 'preference';
  size: number;
  Setting: SettingResponse[];
}

export interface AccountNotification {
  type: 'account';
  size: number;
  AccountUpdateNotification: Array<{
    event: string;
    hasPlexPass?: boolean;
  }>;
}

export type AlertTypes =
  | ActivityNotification
  | StatusNotification
  | TimelineNotification
  | ReachabilityNotification
  | BackgroundProcessingQueueEventNotification
  | PreferenceNotification
  | AccountNotification;
