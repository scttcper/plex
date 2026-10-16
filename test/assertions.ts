import { expect } from 'vitest';

/** Fail the test unless the value exists, then narrow it for the rest of the test. */
export function assertDefined<T>(value: T): asserts value is NonNullable<T> {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

/** First item of a list, failing the test when the list is empty. */
export function first<T>(items: readonly T[]): T {
  const [item] = items;
  assertDefined(item);
  return item;
}

/** Item at an index, failing the test when the list is too short. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  assertDefined(item);
  return item;
}
