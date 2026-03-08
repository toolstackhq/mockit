import { describe, it, expect, afterEach } from 'vitest';
import { HttpInterceptor } from '../../src/interceptor/http-interceptor.js';
import { equals } from '../../src/matchers/string-matchers.js';

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

  it('clears overrides', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .returns(200)
      .withBody([]);

    interceptor.resetOverrides();
    expect(interceptor.listMocks()).toHaveLength(0);
  });
});
