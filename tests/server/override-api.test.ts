import { describe, expect, it } from 'vitest';
import { createOverrideDefinition } from '../../src/server/override-api.js';

describe('override-api helpers', () => {
  it('creates override definitions with matcher variants and response sequences', () => {
    const definition = createOverrideDefinition({
      path: '/api/login',
      method: 'POST',
      count: 2,
      optional: true,
      matchers: {
        headers: {
          authorization: { bearerToken: { startsWith: 'token-' } },
          'x-mode': { endsWith: 'test' },
        },
        cookies: {
          session_id: { contains: 'abc' },
        },
        query: {
          page: { equals: '1' },
        },
        body: [
          { jsonPath: '$.amount', matcher: { greaterThan: 100 } },
          { jsonPath: '$.count', matcher: { lessThan: 10 } },
          { jsonPath: '$.score', matcher: { between: [5, 10] } },
          { jsonPath: '$.name', matcher: { regex: { pattern: '^jo', flags: 'i' } } },
          { jsonPath: '$.meta', matcher: { any: true } },
        ],
        bodyEquals: { role: 'admin' },
      },
      response: {
        status: 403,
        headers: { 'x-source': 'override' },
        body: { message: 'unauthorized' },
      },
      sequence: [
        { status: 429, body: { retry: true } },
      ],
    });

    expect(definition.path).toBe('/api/login');
    expect(definition.method).toBe('POST');
    expect(definition.remainingUses).toBe(2);
    expect(definition.optional).toBe(true);
    expect(definition.persisted).toBe(false);
    expect(definition.headerMatchers.get('authorization')?.match('Bearer token-42')).toBe(true);
    expect(definition.headerMatchers.get('x-mode')?.match('qa-test')).toBe(true);
    expect(definition.cookieMatchers.get('session_id')?.match('zzzabczzz')).toBe(true);
    expect(definition.queryMatchers.get('page')?.match('1')).toBe(true);
    expect(definition.bodyMatchers).toHaveLength(6);
    expect(definition.bodyMatchers[0].matcher.match(200)).toBe(true);
    expect(definition.bodyMatchers[1].matcher.match(5)).toBe(true);
    expect(definition.bodyMatchers[2].matcher.match(7)).toBe(true);
    expect(definition.bodyMatchers[3].matcher.match('John')).toBe(true);
    expect(definition.bodyMatchers[4].matcher.match({ anything: true })).toBe(true);
    expect(definition.bodyMatchers[5].matcher.match({ role: 'admin' })).toBe(true);
    expect(definition.response.status).toBe(403);
    expect(definition.responseSequence).toHaveLength(1);
  });

  it('supports bearer-token body matchers and object equality body matchers', () => {
    const definition = createOverrideDefinition({
      path: '/api/token',
      matchers: {
        body: [
          { jsonPath: '$.auth', matcher: { bearerToken: { startsWith: 'abc' } } },
          { jsonPath: '$.profile', matcher: { equals: { id: 1, role: 'admin' } } },
        ],
      },
      response: { status: 200 },
    });

    expect(definition.bodyMatchers[0].matcher.match('Bearer abc-123')).toBe(true);
    expect(definition.bodyMatchers[0].matcher.match('Basic abc-123')).toBe(false);
    expect(definition.bodyMatchers[1].matcher.match({ id: 1, role: 'admin' })).toBe(true);
  });

  it('treats count 0 as persisted and normalizes null body', () => {
    const definition = createOverrideDefinition({
      path: '/api/countries',
      count: 0,
      response: {
        status: 200,
      },
    });

    expect(definition.persisted).toBe(true);
    expect(definition.remainingUses).toBeUndefined();
    expect(definition.response.body).toBeNull();
  });

  it('rejects invalid override payloads and matcher specs', () => {
    expect(() => createOverrideDefinition({
      path: '',
      response: { status: 200 },
    } as any)).toThrow(/Override path is required/);

    expect(() => createOverrideDefinition({
      path: '/api/test',
      count: -1,
      response: { status: 200 },
    })).toThrow(/non-negative integer/);

    expect(() => createOverrideDefinition({
      path: '/api/test',
      response: { status: 200.5 },
    } as any)).toThrow(/response.status must be an integer/);

    expect(() => createOverrideDefinition({
      path: '/api/test',
      matchers: {
        headers: {
          'x-test': {},
        },
      },
      response: { status: 200 },
    } as any)).toThrow(/Unsupported string matcher spec/);

    expect(() => createOverrideDefinition({
      path: '/api/test',
      matchers: {
        body: [
          { jsonPath: '$.amount', matcher: {} },
        ],
      },
      response: { status: 200 },
    } as any)).toThrow(/Unsupported matcher spec/);
  });
});
