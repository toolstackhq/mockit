import { describe, it, expect, afterEach } from 'vitest';
import { HttpInterceptor } from '../../src/interceptor/http-interceptor.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';

describe('HttpInterceptor', () => {
  let interceptor: HttpInterceptor;

  afterEach(() => {
    if (interceptor?.isActive) {
      interceptor.disable();
    }
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
});
