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
