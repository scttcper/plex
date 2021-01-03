import type { Section } from './library';

export interface MediaContainer<T> {
  MediaContainer: T;
}

export interface MetadataContainer<T extends { Metadata: any }> {
  MediaContainer: T;
}

export function rsplit(str: string, sep: string, maxsplit: number): string[] {
  var split = str.split(sep);
  return maxsplit ? [split.slice(0, -maxsplit).join(sep)].concat(split.slice(-maxsplit)) : split;
}

/**
 * Return the full agent identifier from a short identifier, name, or confirm full identifier.
 * @param section
 * @param agent
 */
export async function getAgentIdentifier(section: Section, agent: string) {
  const agents: any[] = [];
  for (const ag of await section.agents()) {
    const identifiers = [ag.identifier, ag.shortIdentifier, ag.name];
    if (identifiers.includes(agent)) {
      return ag.identifier;
    }

    agents.concat(identifiers);
  }

  throw new Error(`Couldnt find "${agent}" in agents list (${agents.join(', ')})`);
}
