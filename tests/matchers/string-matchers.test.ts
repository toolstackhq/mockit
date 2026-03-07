import { describe, it, expect } from 'vitest';
import { equals, startsWith, endsWith, contains, regex } from '../../src/matchers/string-matchers.js';

describe('String Matchers', () => {
  describe('equals', () => {
    const matcher = equals('hello');

    it('matches exact string', () => {
      expect(matcher.match('hello')).toBe(true);
    });

    it('rejects different string', () => {
      expect(matcher.match('world')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(matcher.match('Hello')).toBe(false);
    });

    it('has descriptive name', () => {
      expect(matcher.name).toBe("equals('hello')");
    });
  });

  describe('startsWith', () => {
    const matcher = startsWith('Bearer');

    it('matches prefix', () => {
      expect(matcher.match('Bearer token123')).toBe(true);
    });

    it('rejects non-matching prefix', () => {
      expect(matcher.match('Basic abc')).toBe(false);
    });

    it('matches exact prefix', () => {
      expect(matcher.match('Bearer')).toBe(true);
    });
  });

  describe('endsWith', () => {
    const matcher = endsWith('.json');

    it('matches suffix', () => {
      expect(matcher.match('data.json')).toBe(true);
    });

    it('rejects non-matching suffix', () => {
      expect(matcher.match('data.xml')).toBe(false);
    });
  });

  describe('contains', () => {
    const matcher = contains('admin');

    it('matches substring', () => {
      expect(matcher.match('user-admin-role')).toBe(true);
    });

    it('rejects missing substring', () => {
      expect(matcher.match('user-guest-role')).toBe(false);
    });
  });

  describe('regex', () => {
    const matcher = regex(/^[A-Z]{3}-\d+$/);

    it('matches pattern', () => {
      expect(matcher.match('ABC-123')).toBe(true);
    });

    it('rejects non-matching', () => {
      expect(matcher.match('abc-123')).toBe(false);
    });
  });
});
