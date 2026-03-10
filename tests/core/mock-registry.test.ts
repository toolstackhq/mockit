import { describe, it, expect, beforeEach } from 'vitest';
import { MockRegistry } from '../../src/core/mock-registry.js';
import { MockDefinition } from '../../src/core/mock-definition.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';
import { greaterThan } from '../../src/matchers/number-matchers.js';

describe('MockRegistry', () => {
  let registry: MockRegistry;

  beforeEach(() => {
    registry = new MockRegistry();
  });

  function makeRequest(overrides: Partial<{
    method: string;
    path: string;
    headers: Record<string, string>;
    cookies: Record<string, string>;
    query: Record<string, string>;
    body: any;
  }> = {}) {
    return {
      method: 'GET',
      path: '/api/users',
      headers: {},
      cookies: {},
      query: {},
      body: null,
      ...overrides,
    };
  }

  describe('basic resolution', () => {
    it('resolves a simple path match', () => {
      const mock = new MockDefinition('/api/users');
      mock.response = { status: 200, headers: {}, body: [{ id: 1 }] };
      registry.add(mock);

      const result = registry.resolve(makeRequest());
      expect(result).not.toBeNull();
      expect(result!.response.status).toBe(200);
    });

    it('returns null when no mock matches', () => {
      const result = registry.resolve(makeRequest({ path: '/api/unknown' }));
      expect(result).toBeNull();
    });

    it('matches path params', () => {
      const mock = new MockDefinition('/api/users/:id');
      mock.response = { status: 200, headers: {}, body: { id: 1 } };
      registry.add(mock);

      const result = registry.resolve(makeRequest({ path: '/api/users/123' }));
      expect(result).not.toBeNull();
    });

    it('rejects path with wrong segment count', () => {
      const mock = new MockDefinition('/api/users');
      registry.add(mock);

      const result = registry.resolve(makeRequest({ path: '/api/users/123' }));
      expect(result).toBeNull();
    });
  });

  describe('method matching', () => {
    it('matches specific method', () => {
      const mock = new MockDefinition('/api/users');
      mock.method = 'POST';
      mock.response = { status: 201, headers: {}, body: null };
      registry.add(mock);

      const result = registry.resolve(makeRequest({ method: 'POST' }));
      expect(result).not.toBeNull();
    });

    it('rejects wrong method', () => {
      const mock = new MockDefinition('/api/users');
      mock.method = 'POST';
      registry.add(mock);

      const result = registry.resolve(makeRequest({ method: 'GET' }));
      expect(result).toBeNull();
    });

    it('matches any method when not specified', () => {
      const mock = new MockDefinition('/api/users');
      registry.add(mock);

      const getResult = registry.resolve(makeRequest({ method: 'GET' }));
      const postResult = registry.resolve(makeRequest({ method: 'POST' }));
      expect(getResult).not.toBeNull();
      expect(postResult).not.toBeNull();
    });
  });

  describe('header matching', () => {
    it('matches header with matcher', () => {
      const mock = new MockDefinition('/api/users');
      mock.headerMatchers.set('authorization', startsWith('Bearer'));
      registry.add(mock);

      const result = registry.resolve(makeRequest({
        headers: { authorization: 'Bearer token123' },
      }));
      expect(result).not.toBeNull();
    });

    it('rejects missing header', () => {
      const mock = new MockDefinition('/api/users');
      mock.headerMatchers.set('authorization', startsWith('Bearer'));
      registry.add(mock);

      const result = registry.resolve(makeRequest());
      expect(result).toBeNull();
    });
  });

  describe('query matching', () => {
    it('matches query parameter', () => {
      const mock = new MockDefinition('/api/users');
      mock.queryMatchers.set('page', equals('1'));
      registry.add(mock);

      const result = registry.resolve(makeRequest({ query: { page: '1' } }));
      expect(result).not.toBeNull();
    });
  });

  describe('cookie matching', () => {
    it('matches cookie parameter', () => {
      const mock = new MockDefinition('/api/users');
      mock.cookieMatchers.set('session_id', equals('abc123'));
      registry.add(mock);

      const result = registry.resolve(makeRequest({ cookies: { session_id: 'abc123' } }));
      expect(result).not.toBeNull();
    });
  });

  describe('body matching', () => {
    it('matches body with JSONPath', () => {
      const mock = new MockDefinition('/api/payment');
      mock.method = 'POST';
      mock.bodyMatchers.push({ jsonPath: '$.amount', matcher: greaterThan(100) });
      registry.add(mock);

      const result = registry.resolve(makeRequest({
        method: 'POST',
        path: '/api/payment',
        body: { amount: 150 },
      }));
      expect(result).not.toBeNull();
    });
  });

  describe('priority resolution', () => {
    it('prefers override over default', () => {
      const defaultMock = new MockDefinition('/api/users', 'default');
      defaultMock.response = { status: 200, headers: {}, body: 'default' };
      registry.add(defaultMock);

      const overrideMock = new MockDefinition('/api/users', 'override');
      overrideMock.response = { status: 200, headers: {}, body: 'override' };
      registry.add(overrideMock);

      const result = registry.resolve(makeRequest());
      expect(result!.response.body).toBe('override');
    });

    it('prefers default over swagger', () => {
      const swaggerMock = new MockDefinition('/api/users', 'swagger');
      swaggerMock.response = { status: 200, headers: {}, body: 'swagger' };
      registry.add(swaggerMock);

      const defaultMock = new MockDefinition('/api/users', 'default');
      defaultMock.response = { status: 200, headers: {}, body: 'default' };
      registry.add(defaultMock);

      const result = registry.resolve(makeRequest());
      expect(result!.response.body).toBe('default');
    });

    it('prefers more specific match within same priority', () => {
      const general = new MockDefinition('/api/users', 'override');
      general.response = { status: 200, headers: {}, body: 'general' };
      registry.add(general);

      const specific = new MockDefinition('/api/users', 'override');
      specific.method = 'GET';
      specific.headerMatchers.set('accept', equals('application/json'));
      specific.response = { status: 200, headers: {}, body: 'specific' };
      registry.add(specific);

      const result = registry.resolve(makeRequest({
        headers: { accept: 'application/json' },
      }));
      expect(result!.response.body).toBe('specific');
    });
  });

  describe('call tracking', () => {
    it('records calls on matched mock', () => {
      const mock = new MockDefinition('/api/users');
      registry.add(mock);

      const first = registry.resolveDetailed(makeRequest());
      const second = registry.resolveDetailed(makeRequest());
      registry.recordMatched(makeRequest(), first.mock!, first.response!);
      registry.recordMatched(makeRequest(), second.mock!, second.response!);

      expect(mock.callCount).toBe(2);
      expect(mock.calls).toHaveLength(2);
    });
  });

  describe('lifecycle controls', () => {
    it('does not resolve exhausted mocks', () => {
      const mock = new MockDefinition('/api/users');
      mock.remainingUses = 1;
      registry.add(mock);

      expect(registry.resolve(makeRequest())).not.toBeNull();
      expect(registry.resolve(makeRequest())).toBeNull();
    });

    it('tracks pending mocks for finite expectations', () => {
      const mock = new MockDefinition('/api/users');
      mock.remainingUses = 2;
      registry.add(mock);

      expect(registry.pendingMocks()).toHaveLength(1);
      registry.resolve(makeRequest());
      expect(registry.pendingMocks()).toHaveLength(1);
      registry.resolve(makeRequest());
      expect(registry.pendingMocks()).toHaveLength(0);
    });

    it('uses sequential responses in order and then sticks on the last reply', () => {
      const mock = new MockDefinition('/api/retry');
      mock.response = { status: 500, headers: {}, body: { retry: true } };
      mock.addSequenceResponse({ status: 200, headers: {}, body: { ok: true } });
      registry.add(mock);

      const first = registry.resolveDetailed(makeRequest({ path: '/api/retry' }));
      const second = registry.resolveDetailed(makeRequest({ path: '/api/retry' }));
      const third = registry.resolveDetailed(makeRequest({ path: '/api/retry' }));

      expect(first.response!.status).toBe(500);
      expect(second.response!.status).toBe(200);
      expect(third.response!.status).toBe(200);
    });
  });

  describe('near misses and journal', () => {
    it('returns near misses for unmatched requests', () => {
      const mock = new MockDefinition('/api/users');
      mock.method = 'POST';
      mock.headerMatchers.set('authorization', startsWith('Bearer'));
      registry.add(mock);

      const result = registry.resolveDetailed(makeRequest({
        method: 'GET',
        headers: { authorization: 'Basic abc' },
      }));

      expect(result.mock).toBeNull();
      expect(result.nearMisses).toHaveLength(1);
      expect(result.nearMisses[0].reasons.join(' ')).toContain('method mismatch');
      expect(result.nearMisses[0].reasons.join(' ')).toContain('header mismatch');
    });

    it('records unmatched and proxied requests in the journal', () => {
      const request = makeRequest({ path: '/api/unknown' });
      registry.recordUnmatched(request, []);
      registry.recordProxied(request, 200, []);

      const journal = registry.listRequests();
      expect(journal).toHaveLength(2);
      expect(journal[0].matched).toBe(false);
      expect(journal[0].proxied).toBe(false);
      expect(journal[1].proxied).toBe(true);

      expect(registry.listUnmatchedRequests()).toHaveLength(2);
      registry.clearJournal();
      expect(registry.listRequests()).toHaveLength(0);
    });

    it('records proxied responses as reusable default mocks', () => {
      const request = makeRequest({
        method: 'GET',
        path: '/api/users',
        query: { tenant: 'bank-a' },
      });

      const recorded = registry.recordProxyMock(request, {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: [{ id: 1 }],
      });

      expect(recorded.priority).toBe('default');
      expect(recorded.queryMatchers.get('tenant')!.match('bank-a')).toBe(true);
      expect(registry.resolve(makeRequest({
        path: '/api/users',
        query: { tenant: 'bank-a' },
      }))).toBe(recorded);
    });
  });

  describe('clear', () => {
    it('clears all mocks', () => {
      registry.add(new MockDefinition('/a'));
      registry.add(new MockDefinition('/b'));
      registry.clear();
      expect(registry.listMocks()).toHaveLength(0);
    });

    it('clears only specified priority', () => {
      registry.add(new MockDefinition('/a', 'override'));
      registry.add(new MockDefinition('/b', 'default'));
      registry.clear('override');
      const mocks = registry.listMocks();
      expect(mocks).toHaveLength(1);
      expect(mocks[0].priority).toBe('default');
    });
  });

  describe('remove', () => {
    it('removes by id', () => {
      const mock = new MockDefinition('/a');
      registry.add(mock);
      expect(registry.remove(mock.id)).toBe(true);
      expect(registry.listMocks()).toHaveLength(0);
    });

    it('returns false for non-existent id', () => {
      expect(registry.remove('non-existent')).toBe(false);
    });
  });
});
