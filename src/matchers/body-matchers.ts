import { JSONPath } from 'jsonpath-plus';
import type { Matcher } from '../core/types.js';

export function bodyPath(jsonPath: string, matcher: Matcher<any>): { jsonPath: string; matcher: Matcher<any> } {
  return { jsonPath, matcher };
}

export function evaluateBodyMatcher(body: any, jsonPath: string, matcher: Matcher<any>): boolean {
  try {
    const results = JSONPath({ path: jsonPath, json: body });
    if (results.length === 0) return false;
    return matcher.match(results[0]);
  } catch {
    return false;
  }
}

export function equalsJson(expected: any): Matcher<any> {
  return {
    name: `equalsJson(${safeStringify(expected)})`,
    match: (value: any) => deepEqual(value, expected),
  };
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (!deepEqual(aKeys, bKeys)) return false;
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
