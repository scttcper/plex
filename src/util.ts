import type { Section } from './library.ts';

export interface MediaContainer<T> {
  MediaContainer: T;
}

export interface MetadataContainer<T extends { Metadata: unknown }> {
  MediaContainer: T;
}

export type PlexBoolean = boolean | 0 | 1 | '0' | '1' | 'false' | 'true';

/** Parse the boolean shapes returned by Plex JSON APIs. */
export function parsePlexBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return value === true || value === 1 || value === '1' || value === 'true';
}

export function rsplit(str: string, sep: string, maxsplit: number): string[] {
  const split = str.split(sep);
  if (maxsplit) {
    return [split.slice(0, -maxsplit).join(sep), ...split.slice(-maxsplit)];
  }

  return split;
}

/**
 * Return the full agent identifier from a short identifier, name, or confirm full identifier.
 */
export async function getAgentIdentifier(section: Section, agent: string) {
  const agents: string[] = [];
  for (const ag of await section.agents()) {
    const identifiers = [ag.identifier, ag.shortIdentifier, ag.name];
    if (identifiers.includes(agent)) {
      return ag.identifier;
    }

    agents.push(...identifiers);
  }

  throw new Error(`Couldnt find "${agent}" in agents list (${agents.join(', ')})`);
}

/** Simple tag helper for editing a object. */
export function tagHelper(
  tag: string,
  items: string[],
  { locked = true, remove = false }: { locked?: boolean; remove?: boolean } = {},
) {
  const data: Record<string, string | number> = {};
  if (remove) {
    const tagname = `${tag}[].tag.tag-`;
    data[tagname] = items.join(',');
  } else {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const tagname = `${tag}[${idx}].tag.tag`;
      data[tagname] = item;
    }
  }

  data[`${tag}.locked`] = locked ? 1 : 0;
  return data;
}

export function ltrim(x: string, characters: string[]): string {
  let start = 0;
  while (characters.includes(x[start])) {
    start += 1;
  }

  return x.slice(start);
}

export function lowerFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const chunkSize = 32_768;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return globalThis.btoa(binary);
}
