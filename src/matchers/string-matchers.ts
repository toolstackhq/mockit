import type { Matcher } from '../core/types.js';

export function equals(value: string): Matcher<string> {
  return {
    name: `equals('${value}')`,
    match: (v: string) => v === value,
    serialize: () => ({ equals: value }),
  };
}

export function startsWith(prefix: string): Matcher<string> {
  return {
    name: `startsWith('${prefix}')`,
    match: (v: string) => v.startsWith(prefix),
    serialize: () => ({ startsWith: prefix }),
  };
}

export function endsWith(suffix: string): Matcher<string> {
  return {
    name: `endsWith('${suffix}')`,
    match: (v: string) => v.endsWith(suffix),
    serialize: () => ({ endsWith: suffix }),
  };
}

export function contains(substring: string): Matcher<string> {
  return {
    name: `contains('${substring}')`,
    match: (v: string) => v.includes(substring),
    serialize: () => ({ contains: substring }),
  };
}

export function regex(pattern: RegExp): Matcher<string> {
  return {
    name: `regex(${pattern})`,
    match: (v: string) => pattern.test(v),
    serialize: () => ({ regex: { pattern: pattern.source, flags: pattern.flags } }),
  };
}
