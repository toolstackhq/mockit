import type { Matcher } from '../core/types.js';

export function assertSerializableMatcher<T>(matcher: Matcher<T>, context: string): Matcher<T> {
  if (typeof matcher?.serialize !== 'function') {
    throw new Error(`${context} only supports built-in serializable matchers`);
  }
  return matcher;
}
