import { describe, it, expect } from 'vitest';
import { evaluateBodyMatcher } from '../../src/matchers/body-matchers.js';
import { equals } from '../../src/matchers/string-matchers.js';
import { greaterThan } from '../../src/matchers/number-matchers.js';

describe('Body Matchers', () => {
  const body = {
    name: 'John',
    age: 30,
    address: {
      city: 'New York',
    },
    tags: ['admin', 'user'],
  };

  it('matches top-level string field', () => {
    expect(evaluateBodyMatcher(body, '$.name', equals('John'))).toBe(true);
  });

  it('rejects non-matching top-level field', () => {
    expect(evaluateBodyMatcher(body, '$.name', equals('Jane'))).toBe(false);
  });

  it('matches nested field', () => {
    expect(evaluateBodyMatcher(body, '$.address.city', equals('New York'))).toBe(true);
  });

  it('matches numeric field', () => {
    expect(evaluateBodyMatcher(body, '$.age', greaterThan(25))).toBe(true);
  });

  it('returns false for non-existent path', () => {
    expect(evaluateBodyMatcher(body, '$.nonexistent', equals('x'))).toBe(false);
  });

  it('handles null body gracefully', () => {
    expect(evaluateBodyMatcher(null, '$.name', equals('x'))).toBe(false);
  });

  it('matches array element', () => {
    expect(evaluateBodyMatcher(body, '$.tags[0]', equals('admin'))).toBe(true);
  });
});
