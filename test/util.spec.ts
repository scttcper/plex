import { describe, expect, it } from '@jest/globals';

import { searchType } from '../src/search';

describe('searchType', () => {
  it('should return matched search types ', () => {
    expect(searchType(1001)).toBe(1001);
    expect(searchType('1001')).toBe(1001);
    expect(searchType('userPlaylistItem')).toBe(1001);
    expect(() => searchType(777)).toThrowError();
  });
});
