import { MockDefinition } from '../core/mock-definition.js';
import type {
  Matcher,
  RemoteBodyMatcherSpec,
  RemoteMatcherSpec,
  RemoteOverrideRequest,
  RemoteResponseSpec,
} from '../core/types.js';
import { any, equalsJson } from '../matchers/index.js';
import { between, greaterThan, lessThan } from '../matchers/number-matchers.js';
import { contains, endsWith, equals, regex, startsWith } from '../matchers/string-matchers.js';

export function createOverrideDefinition(request: RemoteOverrideRequest): MockDefinition {
  if (!request.path) {
    throw new Error('Override path is required');
  }

  const def = new MockDefinition(request.path, 'override');
  if (request.method) {
    def.method = request.method;
  }

  applyCount(def, request.count);
  def.optional = request.optional ?? false;

  for (const [name, spec] of Object.entries(request.matchers?.headers || {})) {
    def.headerMatchers.set(name.toLowerCase(), createStringMatcher(spec));
  }

  for (const [name, spec] of Object.entries(request.matchers?.cookies || {})) {
    def.cookieMatchers.set(name.toLowerCase(), createStringMatcher(spec));
  }

  for (const [name, spec] of Object.entries(request.matchers?.query || {})) {
    def.queryMatchers.set(name, createStringMatcher(spec));
  }

  for (const bodyMatcher of request.matchers?.body || []) {
    def.bodyMatchers.push({
      jsonPath: bodyMatcher.jsonPath,
      matcher: createValueMatcher(bodyMatcher.matcher),
    });
  }

  if (request.matchers && 'bodyEquals' in request.matchers) {
    def.bodyMatchers.push({
      jsonPath: '$',
      matcher: equalsJson(request.matchers.bodyEquals),
    });
  }

  def.response = normalizeResponse(request.response);
  for (const response of request.sequence || []) {
    def.addSequenceResponse(normalizeResponse(response));
  }

  return def;
}

function applyCount(def: MockDefinition, count?: number): void {
  if (count === undefined || count === 0) {
    def.persisted = true;
    def.remainingUses = undefined;
    return;
  }

  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Override count must be a non-negative integer');
  }

  def.persisted = false;
  def.remainingUses = count;
}

function normalizeResponse(response: RemoteResponseSpec) {
  if (!Number.isInteger(response.status)) {
    throw new Error('Override response.status must be an integer');
  }

  return {
    status: response.status,
    headers: response.headers || {},
    body: response.body ?? null,
    delay: response.delay,
    delayRange: response.delayRange,
    template: response.template,
    fault: response.fault,
  };
}

function createStringMatcher(spec: RemoteMatcherSpec): Matcher<string> {
  if (spec.any) return any();
  if (spec.bearerToken) {
    const tokenMatcher = createStringMatcher(spec.bearerToken);
    return {
      name: `bearer(${tokenMatcher.name})`,
      match: (value: string) => {
        const idx = value.indexOf(' ');
        if (idx <= 0) return false;
        const scheme = value.slice(0, idx);
        if (scheme.toLowerCase() !== 'bearer') return false;
        const token = value.slice(idx + 1).trim();
        return token.length > 0 && tokenMatcher.match(token);
      },
      serialize: () => ({ bearerToken: tokenMatcher.serialize() }),
    };
  }
  if (spec.startsWith !== undefined) return startsWith(spec.startsWith);
  if (spec.endsWith !== undefined) return endsWith(spec.endsWith);
  if (spec.contains !== undefined) return contains(spec.contains);
  if (spec.regex !== undefined) return regex(new RegExp(spec.regex.pattern, spec.regex.flags));
  if (spec.equals !== undefined) return equals(String(spec.equals));

  throw new Error('Unsupported string matcher spec');
}

function createValueMatcher(spec: RemoteMatcherSpec): Matcher<any> {
  if (spec.any) return any();
  if (spec.bearerToken) {
    const tokenMatcher = createStringMatcher(spec.bearerToken);
    return {
      name: `bearer(${tokenMatcher.name})`,
      match: (value: string) => {
        if (typeof value !== 'string') return false;
        const idx = value.indexOf(' ');
        if (idx <= 0) return false;
        const scheme = value.slice(0, idx);
        if (scheme.toLowerCase() !== 'bearer') return false;
        const token = value.slice(idx + 1).trim();
        return token.length > 0 && tokenMatcher.match(token);
      },
      serialize: () => ({ bearerToken: tokenMatcher.serialize() }),
    };
  }
  if (spec.startsWith !== undefined) return startsWith(spec.startsWith);
  if (spec.endsWith !== undefined) return endsWith(spec.endsWith);
  if (spec.contains !== undefined) return contains(spec.contains);
  if (spec.regex !== undefined) return regex(new RegExp(spec.regex.pattern, spec.regex.flags));
  if (spec.greaterThan !== undefined) return greaterThan(spec.greaterThan);
  if (spec.lessThan !== undefined) return lessThan(spec.lessThan);
  if (spec.between !== undefined) return between(spec.between[0], spec.between[1]);
  if (spec.equals !== undefined) {
    if (typeof spec.equals === 'string') return equals(spec.equals);
    return equalsJson(spec.equals);
  }

  throw new Error('Unsupported matcher spec');
}
