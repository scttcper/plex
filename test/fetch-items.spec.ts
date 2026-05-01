import { describe, expect, it } from 'vitest';

import { buildQueryKey } from '../src/baseFunctionality.js';

describe('buildQueryKey', () => {
  it('adds includeGuids to plain keys', () => {
    expect(buildQueryKey('/test/key')).toBe('/test/key?includeGuids=1');
  });

  it('appends includeGuids and params to keys with existing queries', () => {
    expect(buildQueryKey('/test/key?foo=bar', { index: 1, type: 2 })).toBe(
      '/test/key?foo=bar&includeGuids=1&index=1&type=2',
    );
  });

  it('does not duplicate an existing includeGuids parameter', () => {
    expect(buildQueryKey('/test/key?includeGuids=1', { title: 'Rush Hour' })).toBe(
      '/test/key?includeGuids=1&title=Rush+Hour',
    );
  });
});
