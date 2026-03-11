import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../../src/server/mock-server.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';

describe('MockServer', () => {
  let server: MockServer;
  const nativeFetch = globalThis.fetch;

  beforeEach(async () => {
    server = new MockServer({ port: 0 });
  });

  afterEach(async () => {
    await server.stop();
    globalThis.fetch = nativeFetch;
  });

  it('starts and stops without error', async () => {
    const { port } = await server.start();
    expect(port).toBeGreaterThan(0);
    await server.stop();
  });

  it('returns 501 when no mock matches', async () => {
    await server.start();
    const res = await fetch(`${server.address}/api/unknown`);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('No mock matched');
  });

  it('returns mocked response for GET', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([{ id: 1, name: 'Test User' }]);

    await server.start();
    const res = await fetch(`${server.address}/api/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 1, name: 'Test User' }]);
  });

  it('returns mocked response for POST with body matching', async () => {
    server.expect('/api/users')
      .method('POST')
      .matchBody('$.name', equals('John'))
      .returns(201)
      .withBody({ id: 2, name: 'John' });

    await server.start();
    const res = await fetch(`${server.address}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('John');
  });

  it('matches path parameters', async () => {
    server.expect('/api/users/:id')
      .method('GET')
      .returns(200)
      .withBody({ id: 42, name: 'User 42' });

    await server.start();
    const res = await fetch(`${server.address}/api/users/42`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(42);
  });

  it('matches query parameters', async () => {
    server.expect('/api/users')
      .method('GET')
      .matchQuery('role', equals('admin'))
      .returns(200)
      .withBody([{ id: 1, role: 'admin' }]);

    await server.start();
    const res = await fetch(`${server.address}/api/users?role=admin`);
    expect(res.status).toBe(200);
  });

  it('matches headers', async () => {
    server.expect('/api/secure')
      .method('GET')
      .matchHeader('Authorization', startsWith('Bearer'))
      .returns(200)
      .withBody({ secure: true });

    await server.start();

    const unauthorized = await fetch(`${server.address}/api/secure`);
    expect(unauthorized.status).toBe(501);

    const authorized = await fetch(`${server.address}/api/secure`, {
      headers: { Authorization: 'Bearer my-token' },
    });
    expect(authorized.status).toBe(200);
  });

  it('sets custom response headers', async () => {
    server.expect('/api/test')
      .returns(200)
      .withHeaders({ 'X-Custom': 'hello' })
      .withBody({});

    await server.start();
    const res = await fetch(`${server.address}/api/test`);
    expect(res.headers.get('X-Custom')).toBe('hello');
  });

  it('tracks call count', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([]);

    await server.start();
    await fetch(`${server.address}/api/users`);
    await fetch(`${server.address}/api/users`);

    const mocks = server.listMocks();
    expect(mocks[0].callCount).toBe(2);
    expect(mocks[0].calls).toHaveLength(2);
  });

  it('reports isInvoked for an override mock', async () => {
    const override = server.expect('/api/invoked')
      .method('GET')
      .returns(200)
      .withBody({ ok: true });

    expect(override.isInvoked()).toBe(false);

    await server.start();
    await fetch(`${server.address}/api/invoked`);

    expect(override.isInvoked()).toBe(true);
  });

  it('supports verify DSL and diagnostics', async () => {
    server.expect('/api/verify')
      .method('GET')
      .returns(200)
      .withBody({ ok: true });

    await server.start();
    expect(server.verify('/api/verify')).toBe(false);
    expect(server.verifyNotCalled('/api/verify')).toBe(true);

    await fetch(`${server.address}/api/verify`);

    expect(server.verify('/api/verify')).toBe(true);
    expect(server.verifyCount('/api/verify', 1)).toBe(true);

    const details = server.explainVerification('/api/verify');
    expect(details.matchedMocks).toBe(1);
    expect(details.totalCallCount).toBe(1);
  });

  it('matches cookies, bearer token, and exact body', async () => {
    server.expect('/api/cookie')
      .matchCookie('session_id', equals('abc123'))
      .returns(200)
      .withBody({ ok: true });

    server.expect('/api/auth')
      .matchBearerToken(startsWith('token-'))
      .returns(200)
      .withBody({ ok: true });

    server.expect('/api/body-equals')
      .method('POST')
      .matchBodyEquals({ amount: 100, currency: 'USD' })
      .returns(200)
      .withBody({ ok: true });

    await server.start();

    const cookieRes = await fetch(`${server.address}/api/cookie`, {
      headers: { Cookie: 'session_id=abc123' },
    });
    expect(cookieRes.status).toBe(200);

    const authRes = await fetch(`${server.address}/api/auth`, {
      headers: { Authorization: 'Bearer token-42' },
    });
    expect(authRes.status).toBe(200);

    const bodyRes = await fetch(`${server.address}/api/body-equals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, currency: 'USD' }),
    });
    expect(bodyRes.status).toBe(200);
  });

  it('renders templated response body', async () => {
    server.expect('/api/template')
      .method('GET')
      .returns(200)
      .withBodyTemplate({
        message: 'Hello {{request.query.name}}',
        route: '{{request.path}}',
      });

    await server.start();
    const res = await fetch(`${server.address}/api/template?name=Dev`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      message: 'Hello Dev',
      route: '/api/template',
    });
  });

  it('supports random delay and empty-response fault', async () => {
    server.expect('/api/delay')
      .returns(200)
      .withRandomDelay(30, 60)
      .withBody({ ok: true });

    server.expect('/api/empty')
      .returns(200)
      .withBody({ ignored: true })
      .withFault('empty-response');

    await server.start();

    const start = Date.now();
    const delayed = await fetch(`${server.address}/api/delay`);
    const elapsed = Date.now() - start;
    expect(delayed.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(25);

    const empty = await fetch(`${server.address}/api/empty`);
    expect(empty.status).toBe(200);
    expect(await empty.text()).toBe('');
  });

  it('resets overrides but keeps defaults', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([]);

    server.resetOverrides();
    expect(server.listMocks()).toHaveLength(0);
  });

  it('throws if started twice', async () => {
    await server.start();
    await expect(server.start()).rejects.toThrow('already running');
  });

  it('supports one-shot mocks with pending expectations', async () => {
    server.expect('/api/once')
      .method('GET')
      .count(1)
      .returns(200)
      .withBody({ ok: true });

    await server.start();

    expect(server.pendingMocks()).toHaveLength(1);

    const first = await fetch(`${server.address}/api/once`);
    expect(first.status).toBe(200);
    expect(server.isDone()).toBe(true);

    const second = await fetch(`${server.address}/api/once`);
    expect(second.status).toBe(501);
  });

  it('treats count(0) as unlimited', async () => {
    server.expect('/api/unlimited')
      .method('GET')
      .count(0)
      .returns(200)
      .withBody({ ok: true });

    await server.start();

    const first = await fetch(`${server.address}/api/unlimited`);
    const second = await fetch(`${server.address}/api/unlimited`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('supports sequential replies for retry flows', async () => {
    server.expect('/api/retry')
      .method('GET')
      .returns(500)
      .withBody({ error: 'retry' })
      .thenReply(200)
      .withBody({ ok: true });

    await server.start();

    const first = await fetch(`${server.address}/api/retry`);
    const second = await fetch(`${server.address}/api/retry`);

    expect(first.status).toBe(500);
    expect(await first.json()).toEqual({ error: 'retry' });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true });
  });

  it('exposes request journal endpoints and clear semantics', async () => {
    server.expect('/api/journal')
      .method('GET')
      .returns(200)
      .withBody({ ok: true });

    await server.start();
    await fetch(`${server.address}/api/journal`);
    await fetch(`${server.address}/api/unknown`);

    const requestsRes = await fetch(`${server.address}/_mockit/api/requests`);
    const unmatchedRes = await fetch(`${server.address}/_mockit/api/unmatched`);
    const pendingRes = await fetch(`${server.address}/_mockit/api/pending`);

    const requests = await requestsRes.json();
    const unmatched = await unmatchedRes.json();
    const pending = await pendingRes.json();

    expect(requests).toHaveLength(2);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].nearMisses).toBeDefined();
    expect(pending).toHaveLength(0);

    const clearRes = await fetch(`${server.address}/_mockit/api/journal`, { method: 'DELETE' });
    expect(clearRes.status).toBe(204);
    expect(server.listRequests()).toHaveLength(0);
  });

  it('returns near-miss diagnostics for unmatched requests', async () => {
    server.expect('/api/secure')
      .method('POST')
      .matchHeader('Authorization', startsWith('Bearer'))
      .returns(200)
      .withBody({ ok: true });

    await server.start();
    const res = await fetch(`${server.address}/api/secure`);

    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.nearMisses).toHaveLength(1);
    expect(body.nearMisses[0].reasons.join(' ')).toContain('method mismatch');
  });

  it('proxies and records unhandled requests using the configured fetch path', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe('http://upstream.test/api/proxy-me?tenant=bank-a');
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ via: 'proxy' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Upstream': 'yes' },
      });
    };

    server.setUnhandledRequests('proxy', 'http://upstream.test', true);
    await server.start();

    const res = await nativeFetch(`${server.address}/api/proxy-me?tenant=bank-a`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-upstream')).toBe('yes');
    expect(await res.json()).toEqual({ via: 'proxy' });
    expect(server.listRequests()[0].proxied).toBe(true);
    expect(server.listMocks().some((mock) => mock.priority === 'default')).toBe(true);
  });

  it('returns 500 when proxying throws unexpectedly', async () => {
    globalThis.fetch = async () => {
      throw new Error('upstream down');
    };

    server.setUnhandledRequests('proxy', 'http://upstream.test');
    await server.start();

    const res = await nativeFetch(`${server.address}/api/error`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal mock server error');
  });

  it('loads swagger definitions directly on the server', async () => {
    await server.loadSwagger(new URL('../swagger/fixtures/petstore.yaml', import.meta.url).pathname);
    expect(server.listMocks().some((mock) => mock.priority === 'swagger')).toBe(true);
  });

  it('allows remote override creation against a running server', async () => {
    await server.start();

    const createRes = await fetch(`${server.address}/_mockit/api/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/api/login',
        method: 'POST',
        count: 1,
        matchers: {
          headers: {
            authorization: { startsWith: 'Bearer' },
          },
        },
        response: {
          status: 403,
          body: { message: 'unauthorized' },
        },
      }),
    });

    expect(createRes.status).toBe(201);

    const mockRes = await fetch(`${server.address}/api/login`, {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(mockRes.status).toBe(403);
    expect(await mockRes.json()).toEqual({ message: 'unauthorized' });

    const second = await fetch(`${server.address}/api/login`, {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(second.status).toBe(501);
  });

  it('lists and clears remote overrides', async () => {
    await server.start();

    await fetch(`${server.address}/_mockit/api/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/api/profile',
        method: 'GET',
        response: {
          status: 200,
          body: { ok: true },
        },
      }),
    });

    const listRes = await fetch(`${server.address}/_mockit/api/overrides`);
    expect(listRes.status).toBe(200);
    const overrides = await listRes.json();
    expect(overrides).toHaveLength(1);
    expect(overrides[0].path).toBe('/api/profile');

    const clearRes = await fetch(`${server.address}/_mockit/api/overrides`, {
      method: 'DELETE',
    });
    expect(clearRes.status).toBe(204);

    const afterClear = await fetch(`${server.address}/_mockit/api/overrides`);
    expect(await afterClear.json()).toHaveLength(0);
  });

  it('supports remote body and sequence matchers', async () => {
    await server.start();

    const createRes = await fetch(`${server.address}/_mockit/api/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/api/payment',
        method: 'POST',
        matchers: {
          body: [
            {
              jsonPath: '$.amount',
              matcher: { greaterThan: 100 },
            },
          ],
        },
        response: {
          status: 500,
          body: { retry: true },
        },
        sequence: [
          {
            status: 200,
            body: { ok: true },
          },
        ],
      }),
    });

    expect(createRes.status).toBe(201);

    const first = await fetch(`${server.address}/api/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 200 }),
    });
    const second = await fetch(`${server.address}/api/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 200 }),
    });

    expect(first.status).toBe(500);
    expect(await first.json()).toEqual({ retry: true });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true });
  });

  it('rejects invalid remote overrides', async () => {
    await server.start();

    const res = await fetch(`${server.address}/_mockit/api/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        response: { status: 200 },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid override request');
  });
});
