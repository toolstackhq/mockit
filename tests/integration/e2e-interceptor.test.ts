import { describe, it, expect, afterEach } from 'vitest';
import { HttpInterceptor, equals, startsWith } from '../../src/index.js';

describe('E2E: HttpInterceptor', () => {
  let interceptor: HttpInterceptor;

  afterEach(() => {
    if (interceptor?.isActive) {
      interceptor.disable();
    }
  });

  it('intercepts and mocks GET requests', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([{ id: 1, name: 'Intercepted User' }]);

    interceptor.enable();

    const res = await fetch('http://api.internal/api/users');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe('Intercepted User');
  });

  it('intercepts POST with body matching', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/transfers')
      .method('POST')
      .matchBody('$.amount', equals(500))
      .returns(200)
      .withBody({ transactionId: 'TXN-001', status: 'completed' });

    interceptor.enable();

    const res = await fetch('http://api.internal/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, to: 'ACC-002' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactionId).toBe('TXN-001');
  });

  it('supports multiple mocks simultaneously', async () => {
    interceptor = new HttpInterceptor();

    interceptor.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([{ id: 1 }]);

    interceptor.expect('/api/accounts')
      .method('GET')
      .returns(200)
      .withBody([{ id: 'ACC-001' }]);

    interceptor.enable();

    const usersRes = await fetch('http://api.internal/api/users');
    const accountsRes = await fetch('http://api.internal/api/accounts');

    expect((await usersRes.json())[0].id).toBe(1);
    expect((await accountsRes.json())[0].id).toBe('ACC-001');
  });

  it('restores fetch after disable', async () => {
    const originalFetch = globalThis.fetch;

    interceptor = new HttpInterceptor();
    interceptor.expect('/api/test')
      .returns(200)
      .withBody({});

    interceptor.enable();
    expect(globalThis.fetch).not.toBe(originalFetch);

    interceptor.disable();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('clears overrides without affecting defaults', async () => {
    interceptor = new HttpInterceptor();

    interceptor.expect('/api/test')
      .returns(200)
      .withBody({ msg: 'override' });

    expect(interceptor.listMocks()).toHaveLength(1);
    interceptor.resetOverrides();
    expect(interceptor.listMocks()).toHaveLength(0);
  });
});
