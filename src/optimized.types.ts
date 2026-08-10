import type { LiteralUnion } from 'type-fest';

export type OptimizationPreset = 'mobile' | 'original' | 'tv';

/** Common states returned by Plex, while allowing server-specific values. */
export type OptimizationState = LiteralUnion<
  'complete' | 'failed' | 'pending' | 'processing',
  string
>;

export interface CustomOptimizationTarget {
  /** Device profile understood by Plex, such as `Universal Mobile` or `Universal TV`. */
  profile: string;
  /** Maximum encoded video bitrate in kilobits per second. */
  maxBitrate: number;
  /** Display name shown by Plex. Defaults to `Custom: ${profile}`. */
  name?: string;
  /** Plex's 0-100 encoder quality value. */
  quality: number;
  /** Maximum encoded dimensions. */
  resolution: {
    height: number;
    width: number;
  };
}

export interface OptimizeOptions {
  /** Built-in preset or an explicit custom encoding target. */
  target: CustomOptimizationTarget | OptimizationPreset;
  /** Maximum number of matching videos to optimize. Omit to optimize all matches. */
  limit?: number;
  /** Store beside the original media by default, or select a library location by ID. */
  location?: 'alongside-original' | { id: number };
  /** Display name for the optimized group. Defaults to the media item's title. */
  title?: string;
  /** Only optimize unwatched videos. */
  unwatchedOnly?: boolean;
}
