import { describe, it, expect } from 'vitest';
import { greaterThan, lessThan, between, equalsNumber } from '../../src/matchers/number-matchers.js';

describe('Number Matchers', () => {
  describe('greaterThan', () => {
    const matcher = greaterThan(10);

    it('matches greater value', () => {
      expect(matcher.match(11)).toBe(true);
    });

    it('rejects equal value', () => {
      expect(matcher.match(10)).toBe(false);
    });

    it('rejects lesser value', () => {
      expect(matcher.match(9)).toBe(false);
    });
  });

  describe('lessThan', () => {
    const matcher = lessThan(10);

    it('matches lesser value', () => {
      expect(matcher.match(9)).toBe(true);
    });

    it('rejects equal value', () => {
      expect(matcher.match(10)).toBe(false);
    });

    it('rejects greater value', () => {
      expect(matcher.match(11)).toBe(false);
    });
  });

  describe('between', () => {
    const matcher = between(1, 10);

    it('matches value in range', () => {
      expect(matcher.match(5)).toBe(true);
    });

    it('matches lower bound (inclusive)', () => {
      expect(matcher.match(1)).toBe(true);
    });

    it('matches upper bound (inclusive)', () => {
      expect(matcher.match(10)).toBe(true);
    });

    it('rejects value below range', () => {
      expect(matcher.match(0)).toBe(false);
    });

    it('rejects value above range', () => {
      expect(matcher.match(11)).toBe(false);
    });
  });

  describe('equalsNumber', () => {
    const matcher = equalsNumber(42);

    it('matches exact number', () => {
      expect(matcher.match(42)).toBe(true);
    });

    it('rejects different number', () => {
      expect(matcher.match(43)).toBe(false);
    });
  });
});
