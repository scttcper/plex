import { describe, expect, it } from 'vitest';

import { searchType } from '../src/search.js';
import { lowerFirst, ltrim, rsplit, tagHelper } from '../src/util.js';

describe('searchType', () => {
  it('should return matched search types ', () => {
    expect(searchType(1001)).toBe(1001);
    expect(searchType('1001')).toBe(1001);
    expect(searchType('userPlaylistItem')).toBe(1001);
    expect(() => searchType(777)).toThrowError();
  });
});

describe('tagHelper', () => {
  it('should build tag object', () => {
    expect(tagHelper('test', ['a', 'b'])).toEqual({
      'test.locked': 1,
      'test[0].tag.tag': 'a',
      'test[1].tag.tag': 'b',
    });
  });

  it('should build remove tag object', () => {
    expect(tagHelper('test', ['a', 'b'], undefined, true)).toEqual({
      'test.locked': 1,
      'test[].tag.tag-': 'a,b',
    });
  });

  it('should build unlocked tag object', () => {
    expect(tagHelper('test', ['a', 'b'], false)).toEqual({
      'test.locked': 0,
      'test[0].tag.tag': 'a',
      'test[1].tag.tag': 'b',
    });
  });
});

describe('ltrim', () => {
  it('should trim characters from the left of the string', () => {
    expect(ltrim('////hello', ['/'])).toBe('hello');
  });
});

describe('lowerFirst', () => {
  it('should lowercase the first character', () => {
    expect(lowerFirst('Hello')).toBe('hello');
    expect(lowerFirst('HELLO')).toBe('hELLO');
  });
});

describe('rsplit', () => {
  it('should split from the right', () => {
    expect(rsplit('a/b/c', '/', 1)).toEqual(['a/b', 'c']);
    expect(rsplit('a/b/c', '/', 2)).toEqual(['a', 'b', 'c']);
  });

  it('should return original when no maxsplit', () => {
    expect(rsplit('a/b/c', '/', 0)).toEqual(['a', 'b', 'c']);
  });
});
