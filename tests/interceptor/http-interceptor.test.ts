import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { HttpInterceptor } from '../../src/interceptor/http-interceptor.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';

describe('HttpInterceptor', () => {
  let interceptor: HttpInterceptor;
  const nativeFetch = globalThis.fetch;

  afterEach(() => {
    if (interceptor?.isActive) {
      interceptor.disable();
    }
    globalThis.fetch = nativeFetch;
  });

  it('intercepts fetch calls', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([{ id: 1, name: 'Mocked User' }]);

    interceptor.enable();

    const res = await fetch('http://localhost/api/users');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 1, name: 'Mocked User' }]);
  });

  it('intercepts POST with body', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .method('POST')
      .matchBody('$.name', equals('John'))
      .returns(201)
      .withBody({ id: 2, name: 'John' });

    interceptor.enable();

    const res = await fetch('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('John');
  });

  it('intercepts with query parameters', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .method('GET')
      .matchQuery('role', equals('admin'))
      .returns(200)
      .withBody([{ role: 'admin' }]);

    interceptor.enable();

    const res = await fetch('http://localhost/api/users?role=admin');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].role).toBe('admin');
  });

  it('restores original fetch on disable', async () => {
    const originalFetch = globalThis.fetch;
    interceptor = new HttpInterceptor();
    interceptor.enable();
    interceptor.disable();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('sets custom response headers', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/test')
      .returns(200)
      .withHeaders({ 'X-Custom': 'hello' })
      .withBody({});

    interceptor.enable();
    const res = await fetch('http://localhost/api/test');
    expect(res.headers.get('X-Custom')).toBe('hello');
  });

  it('tracks call count', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .returns(200)
      .withBody([]);

    interceptor.enable();
    await fetch('http://localhost/api/users');
    await fetch('http://localhost/api/users');

    const mocks = interceptor.listMocks();
    expect(mocks[0].callCount).toBe(2);
  });

  it('supports verify DSL', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/verify')
      .method('GET')
      .returns(200)
      .withBody({ ok: true });

    interceptor.enable();
    expect(interceptor.verify('/api/verify')).toBe(false);

    await fetch('http://localhost/api/verify');

    expect(interceptor.verify('/api/verify')).toBe(true);
    expect(interceptor.verifyCount('/api/verify', 1)).toBe(true);
    expect(interceptor.verifyNotCalled('/api/verify', { method: 'POST' })).toBe(true);
  });

  it('matches cookies, bearer token, and exact body', async () => {
    interceptor = new HttpInterceptor();

    interceptor.expect('/api/cookie')
      .matchCookie('session_id', equals('abc123'))
      .returns(200)
      .withBody({ ok: true });

    interceptor.expect('/api/auth')
      .matchBearerToken(startsWith('token-'))
      .returns(200)
      .withBody({ ok: true });

    interceptor.expect('/api/body-equals')
      .method('POST')
      .matchBodyEquals({ amount: 100, currency: 'USD' })
      .returns(200)
      .withBody({ ok: true });

    interceptor.enable();

    const cookieRes = await fetch('http://localhost/api/cookie', {
      headers: { Cookie: 'session_id=abc123' },
    });
    expect(cookieRes.status).toBe(200);

    const authRes = await fetch('http://localhost/api/auth', {
      headers: { Authorization: 'Bearer token-xyz' },
    });
    expect(authRes.status).toBe(200);

    const bodyRes = await fetch('http://localhost/api/body-equals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, currency: 'USD' }),
    });
    expect(bodyRes.status).toBe(200);
  });

  it('renders templated responses and simulates faults', async () => {
    interceptor = new HttpInterceptor();

    interceptor.expect('/api/template')
      .method('GET')
      .returns(200)
      .withBodyTemplate({ msg: 'Hi {{request.query.name}}' });

    interceptor.expect('/api/empty')
      .returns(200)
      .withBody({ ignored: true })
      .withFault('empty-response');

    interceptor.expect('/api/reset')
      .returns(500)
      .withFault('connection-reset');

    interceptor.enable();

    const templated = await fetch('http://localhost/api/template?name=QA');
    expect(await templated.json()).toEqual({ msg: 'Hi QA' });

    const empty = await fetch('http://localhost/api/empty');
    expect(await empty.text()).toBe('');

    await expect(fetch('http://localhost/api/reset')).rejects.toThrow(/connection reset/i);
  });

  it('clears overrides', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .returns(200)
      .withBody([]);

    interceptor.resetOverrides();
    expect(interceptor.listMocks()).toHaveLength(0);
  });

  it('blocks unhandled requests when fail mode is enabled', async () => {
    interceptor = new HttpInterceptor({ onUnhandled: 'fail' });
    interceptor.enable();

    await expect(fetch('http://localhost/api/unhandled')).rejects.toThrow(/blocked unhandled request/i);
    expect(interceptor.listUnmatchedRequests()).toHaveLength(1);
  });

  it('proxies and records unhandled requests', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe('http://upstream.test/api/proxy-me');
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ via: 'proxy' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    interceptor = new HttpInterceptor({
      onUnhandled: 'proxy',
      proxyBaseUrl: 'http://upstream.test',
      recordProxiedResponses: true,
    });
    interceptor.enable();

    const first = await fetch('http://localhost/api/proxy-me');
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ via: 'proxy' });
    expect(interceptor.listRequests()[0].proxied).toBe(true);

    const second = await fetch('http://localhost/api/proxy-me');
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ via: 'proxy' });
    expect(interceptor.listMocks().some((mock) => mock.priority === 'default')).toBe(true);
  });

  it('tracks matched requests in the journal', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/journal')
      .returns(200)
      .withBody({ ok: true });

    interceptor.enable();
    await fetch('http://localhost/api/journal');

    expect(interceptor.listRequests()).toHaveLength(1);
    expect(interceptor.listRequests()[0].matched).toBe(true);
    interceptor.clearHistory();
    expect(interceptor.listRequests()).toHaveLength(0);
  });

  it('passes through unmatched requests by default', async () => {
    globalThis.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ passthrough: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    interceptor = new HttpInterceptor();
    interceptor.enable();

    const res = await fetch('http://localhost/api/real');
    expect(await res.json()).toEqual({ passthrough: true });
    expect(interceptor.listUnmatchedRequests()).toHaveLength(1);
  });

  it('supports URL and Request inputs plus runtime setter configuration', async () => {
    interceptor = new HttpInterceptor();
    interceptor.setUnhandledRequests('fail');
    interceptor.expect('/api/request-object')
      .method('POST')
      .matchHeader('x-mode', equals('request'))
      .matchBody('$.name', equals('Jane'))
      .returns(200)
      .withBody({ ok: true });

    interceptor.expect('/api/url-object')
      .method('GET')
      .returns(200)
      .withBody({ ok: 'url' });

    interceptor.enable();

    const requestRes = await fetch(new Request('http://localhost/api/request-object', {
      method: 'POST',
      headers: {
        'X-Mode': 'request',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Jane' }),
    }));
    expect(await requestRes.json()).toEqual({ ok: true });

    const urlRes = await fetch(new URL('http://localhost/api/url-object'));
    expect(await urlRes.json()).toEqual({ ok: 'url' });
  });

  it('loads defaults and swagger mocks directly on the interceptor', async () => {
    interceptor = new HttpInterceptor();
    await interceptor.loadDefaults(resolve(import.meta.dirname, '../config/fixtures/test-config.ts'));
    await interceptor.loadSwagger(resolve(import.meta.dirname, '../swagger/fixtures/petstore.yaml'));

    expect(interceptor.listMocks().some((mock) => mock.priority === 'default')).toBe(true);
    expect(interceptor.listMocks().some((mock) => mock.priority === 'swagger')).toBe(true);
  });

  it('disable is a no-op when interception is not active', () => {
    interceptor = new HttpInterceptor();
    interceptor.disable();
    expect(interceptor.isActive).toBe(false);
  });
});
