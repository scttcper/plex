import type { PartialPlexObject } from './base/partialPlexObject.ts';
import { fetchItems, type PlexItemConstructor } from './baseFunctionality.ts';
import { Art, Logo, Poster, SquareArt } from './media.ts';

export const ArtworkKind = {
  Art: 'art',
  Logo: 'logo',
  Poster: 'poster',
  SquareArt: 'squareArt',
} as const;

export type ArtworkKind = (typeof ArtworkKind)[keyof typeof ArtworkKind];
export type ArtworkResource = Art | Logo | Poster | SquareArt;

export type UploadArtworkOptions =
  | { kind: ArtworkKind; data: Uint8Array; url?: never }
  | { kind: ArtworkKind; data?: never; url: string };

export interface SetArtworkLockedOptions {
  kind: ArtworkKind;
  locked: boolean;
}

const artworkPaths = {
  art: { collection: 'arts', field: 'art', selected: 'art' },
  logo: { collection: 'clearLogos', field: 'clearLogo', selected: 'clearLogo' },
  poster: { collection: 'posters', field: 'thumb', selected: 'thumb' },
  squareArt: { collection: 'squareArts', field: 'squareArt', selected: 'squareArt' },
} as const satisfies Record<ArtworkKind, { collection: string; field: string; selected: string }>;

/** Manage selectable artwork attached to a Plex metadata object. */
export class ArtworkManager {
  private readonly parent: PartialPlexObject;

  constructor(parent: PartialPlexObject) {
    this.parent = parent;
  }

  async arts(): Promise<Art[]> {
    return this.resources(ArtworkKind.Art, Art);
  }

  async logos(): Promise<Logo[]> {
    return this.resources(ArtworkKind.Logo, Logo);
  }

  async posters(): Promise<Poster[]> {
    return this.resources(ArtworkKind.Poster, Poster);
  }

  async squareArts(): Promise<SquareArt[]> {
    return this.resources(ArtworkKind.SquareArt, SquareArt);
  }

  async select(resource: ArtworkResource): Promise<PartialPlexObject> {
    await resource.select();
    return this.parent;
  }

  async upload(options: UploadArtworkOptions): Promise<PartialPlexObject> {
    const path = this.collectionPath(options.kind);
    if (options.url !== undefined) {
      const params = new URLSearchParams({ url: options.url });
      await this.parent.server.query({ path: `${path}?${params.toString()}`, method: 'post' });
    } else {
      await this.parent.server.query({ path, method: 'post', body: options.data });
    }

    return this.parent;
  }

  async setLocked({ kind, locked }: SetArtworkLockedOptions): Promise<PartialPlexObject> {
    await this.parent.edit({ [`${artworkPaths[kind].field}.locked`]: locked ? 1 : 0 });
    return this.parent;
  }

  async delete(kind: ArtworkKind): Promise<PartialPlexObject> {
    this.assertRatingKey();
    await this.parent.server.query({
      path: `/library/metadata/${this.parent.ratingKey}/${artworkPaths[kind].selected}`,
      method: 'delete',
    });
    return this.parent;
  }

  private async resources<T extends ArtworkResource>(
    kind: ArtworkKind,
    Resource: PlexItemConstructor<T>,
  ): Promise<T[]> {
    return fetchItems(
      this.parent.server,
      this.collectionPath(kind),
      undefined,
      Resource,
      this.parent,
    );
  }

  private collectionPath(kind: ArtworkKind): string {
    this.assertRatingKey();
    return `/library/metadata/${this.parent.ratingKey}/${artworkPaths[kind].collection}`;
  }

  private assertRatingKey(): void {
    if (!this.parent.ratingKey) {
      throw new Error('Cannot manage artwork for an object without a ratingKey.');
    }
  }
}
