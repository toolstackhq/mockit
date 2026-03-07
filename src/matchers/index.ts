export { equals, startsWith, endsWith, contains, regex } from './string-matchers.js';
export { greaterThan, lessThan, between, equalsNumber } from './number-matchers.js';
export { bodyPath, evaluateBodyMatcher } from './body-matchers.js';
export type { Matcher } from './types.js';

import type { Matcher } from '../core/types.js';

export function any(): Matcher<any> {
  return {
    name: 'any()',
    match: () => true,
  };
}
