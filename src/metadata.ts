/** Known editable Plex metadata fields. Custom fields remain available through edit(). */
export interface MetadataFields {
  title: string;
  titleSort: string;
  summary: string;
  contentRating: string;
  studio: string;
  tagline: string;
  originalTitle: string;
  editionTitle: string;
  originallyAvailableAt: string;
  addedAt: Date;
  audienceRating: number;
  rating: number;
  userRating: number;
  index: number;
  parentIndex: number;
}

export type MetadataFieldUpdates = Readonly<Partial<MetadataFields>>;
export interface MetadataEditOptions {
  /** Lock edited fields against agent refreshes. Defaults to true. */
  locked?: boolean;
}

export interface MetadataTagEditOptions {
  /** Server-defined tag name, for example genre, collection, country, or mood. */
  tag: string;
  items: readonly string[];
  /** Lock the edited tag against agent refreshes. Defaults to true. */
  locked?: boolean;
  /** Remove only the supplied tags. Defaults to adding them to existing tags. */
  remove?: boolean;
}

/** Serialize multiple field edits into a single Plex edit request. */
export function metadataFieldChanges(
  fields: MetadataFieldUpdates,
  { locked = true }: MetadataEditOptions = {},
): Record<string, string | number> {
  const changes: Record<string, string | number> = {};
  for (const [field, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    changes[`${field}.value`] = value instanceof Date ? Math.floor(value.getTime() / 1000) : value;
    changes[`${field}.locked`] = Number(locked);
  }
  return changes;
}
