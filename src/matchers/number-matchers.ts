import type { Matcher } from '../core/types.js';

export function greaterThan(n: number): Matcher<number> {
  return {
    name: `greaterThan(${n})`,
    match: (v: number) => v > n,
    serialize: () => ({ greaterThan: n }),
  };
}

export function lessThan(n: number): Matcher<number> {
  return {
    name: `lessThan(${n})`,
    match: (v: number) => v < n,
    serialize: () => ({ lessThan: n }),
  };
}

export function between(min: number, max: number): Matcher<number> {
  return {
    name: `between(${min}, ${max})`,
    match: (v: number) => v >= min && v <= max,
    serialize: () => ({ between: [min, max] }),
  };
}

export function equalsNumber(value: number): Matcher<number> {
  return {
    name: `equals(${value})`,
    match: (v: number) => v === value,
    serialize: () => ({ equals: value }),
  };
}
