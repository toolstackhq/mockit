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

  it('verifies invocation using verify DSL', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/verify-hit')
      .method('GET')
      .returns(200)
      .withBody({ ok: true });

    interceptor.enable();

    expect(interceptor.verify('/api/verify-hit')).toBe(false);
    await fetch('http://api.internal/api/verify-hit');
    expect(interceptor.verify('/api/verify-hit')).toBe(true);
    expect(interceptor.verifyCount('/api/verify-hit', 1)).toBe(true);
  });

  it('supports cookie, bearer, and exact-body matching e2e', async () => {
    interceptor = new HttpInterceptor();

    interceptor.expect('/api/secure-transfer')
      .method('POST')
      .matchCookie('session_id', equals('abc123'))
      .matchBearerToken(startsWith('token-'))
      .matchBodyEquals({ amount: 100, currency: 'USD' })
      .returns(200)
      .withBody({ accepted: true });

    interceptor.enable();

    const res = await fetch('http://api.internal/api/secure-transfer', {
      method: 'POST',
      headers: {
        Cookie: 'session_id=abc123',
        Authorization: 'Bearer token-qa',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 100, currency: 'USD' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: true });
  });

  it('supports templating and faults e2e', async () => {
    interceptor = new HttpInterceptor();

    interceptor.expect('/api/template-user')
      .method('GET')
      .returns(200)
      .withBodyTemplate({
        message: 'Hello {{request.query.name}}',
        route: '{{request.path}}',
      });

    interceptor.expect('/api/empty-fault')
      .method('GET')
      .returns(200)
      .withBody({ ignored: true })
      .withFault('empty-response');

    interceptor.expect('/api/reset-fault')
      .method('GET')
      .returns(500)
      .withFault('connection-reset');

    interceptor.enable();

    const templated = await fetch('http://api.internal/api/template-user?name=QA');
    expect(await templated.json()).toEqual({
      message: 'Hello QA',
      route: '/api/template-user',
    });

    const empty = await fetch('http://api.internal/api/empty-fault');
    expect(empty.status).toBe(200);
    expect(await empty.text()).toBe('');

    await expect(fetch('http://api.internal/api/reset-fault')).rejects.toThrow(/connection reset/i);
  });
});
