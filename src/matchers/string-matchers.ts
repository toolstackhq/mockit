import type { Matcher } from '../core/types.js';

export function equals(value: string): Matcher<string> {
  return {
    name: `equals('${value}')`,
    match: (v: string) => v === value,
  };
}

export function startsWith(prefix: string): Matcher<string> {
  return {
    name: `startsWith('${prefix}')`,
    match: (v: string) => v.startsWith(prefix),
  };
}

export function endsWith(suffix: string): Matcher<string> {
  return {
    name: `endsWith('${suffix}')`,
    match: (v: string) => v.endsWith(suffix),
  };
}

export function contains(substring: string): Matcher<string> {
  return {
    name: `contains('${substring}')`,
    match: (v: string) => v.includes(substring),
  };
}

export function regex(pattern: RegExp): Matcher<string> {
  return {
    name: `regex(${pattern})`,
    match: (v: string) => pattern.test(v),
  };
}
