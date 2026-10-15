import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { stringToBase64 } from 'uint8array-extras';

import { NotFound } from './exceptions.ts';
import type { Section } from './library.ts';
import type { PlexServer } from './server.ts';

/** A class that constructs `T`. */
export type Class<T, Arguments extends unknown[] = any[]> = {
  prototype: Pick<T, keyof T>;
  new (...args: Arguments): T;
};

/** Known string values that still autocomplete but accept any other string Plex may send. */
export type LiteralUnion<Literal extends string> = Literal | (string & Record<never, never>);

export interface MediaContainer<T> {
  MediaContainer: T;
}

export interface MetadataContainer<T extends { Metadata: unknown }> {
  MediaContainer: T;
}

export type PlexBoolean = boolean | 0 | 1 | '0' | '1' | 'false' | 'true';

/** Parse an optional numeric Plex value. Missing and non-numeric values become undefined. */
export function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const result = Number(value);
  return Number.isNaN(result) ? undefined : result;
}

/** Parse a Plex unix timestamp in seconds or a date string. */
export function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    return new Date(Number(value) * 1000);
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** First metadata entry of a Plex container, or NotFound when Plex returned none. */
export function firstMetadata<T>(data: { Metadata?: readonly T[] }, key: string | undefined): T {
  const [metadata] = data.Metadata ?? [];
  if (metadata === undefined) {
    throw new NotFound(`No metadata returned for "${key}".`);
  }
  return metadata;
}

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
    const identifiers = [ag.identifier, ag.shortIdentifier, ...(ag.name ? [ag.name] : [])];
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
    data[tagname] = items.map(item => encodeURIComponent(item)).join(',');
  } else {
    for (const [idx, item] of items.entries()) {
      data[`${tag}[${idx}].tag.tag`] = item;
    }
  }

  data[`${tag}.locked`] = locked ? 1 : 0;
  return data;
}

export function ltrim(x: string, characters: string[]): string {
  let start = 0;
  while (start < x.length && characters.includes(x.charAt(start))) {
    start += 1;
  }

  return x.slice(start);
}

export function lowerFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function encodeBase64(value: string): string {
  return stringToBase64(value);
}

/** Address parameters players need to fetch media from a server. */
export function serverAddressParams(server: PlexServer): {
  protocol: string;
  address: string;
  port: number;
} {
  const url = new URL(server.baseurl);
  return {
    protocol: url.protocol.slice(0, -1),
    address: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
  };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  ignoreDeclaration: true,
  parseAttributeValue: false,
  parseTagValue: false,
  // Every child element is a list like in Plex JSON, the root element stays an object.
  isArray: (_name, jpath, _isLeafNode, isAttribute) => !isAttribute && String(jpath).includes('.'),
});

/**
 * Parse an XML body into the shape Plex uses for JSON: attributes become properties and child
 * elements become arrays keyed by tag name. Attribute values stay strings.
 */
export function parsePlexXml(text: string): Record<string, unknown> {
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    throw new SyntaxError(`Invalid XML: ${validation.err.msg}`);
  }

  return xmlParser.parse(text) as Record<string, unknown>;
}
