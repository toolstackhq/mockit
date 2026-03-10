import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { MockServer, equals, startsWith } from '../../src/index.js';

describe('E2E: MockServer', () => {
  let server: MockServer;

  beforeAll(async () => {
    server = new MockServer({ port: 0 });

    await server.loadDefaults(resolve(import.meta.dirname, '../config/fixtures/test-config.ts'));

    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  afterEach(() => {
    server.resetOverrides();
  });

  it('serves default mocks from config', async () => {
    const res = await fetch(`${server.address}/api/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 1, name: 'Default User' }]);
  });

  it('overrides default mock with test-specific mock', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([{ id: 99, name: 'Override User' }]);

    const res = await fetch(`${server.address}/api/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 99, name: 'Override User' }]);
  });

  it('reverts to default after resetOverrides', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(500)
      .withBody({ error: 'Server Error' });

    // Override is active
    let res = await fetch(`${server.address}/api/users`);
    expect(res.status).toBe(500);

    // Reset overrides
    server.resetOverrides();

    // Default is back
    res = await fetch(`${server.address}/api/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 1, name: 'Default User' }]);
  });

  it('serves mocked POST responses', async () => {
    server.expect('/api/users')
      .method('POST')
      .matchBody('$.name', equals('John'))
      .returns(201)
      .withBody({ id: 2, name: 'John' });

    const res = await fetch(`${server.address}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: 2, name: 'John' });
  });

  it('returns 501 for unmatched routes', async () => {
    const res = await fetch(`${server.address}/api/nonexistent`);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('No mock matched');
  });

  it('matches path parameters from defaults', async () => {
    const res = await fetch(`${server.address}/api/users/42`, {
      headers: { Authorization: 'Bearer my-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: 1, name: 'Default User' });
  });

  it('simulates error scenarios for specific tests', async () => {
    server.expect('/api/payment/charge')
      .method('POST')
      .returns(402)
      .withBody({ error: 'Card declined' });

    const res = await fetch(`${server.address}/api/payment/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('Card declined');
  });

  it('tracks call history for assertions', async () => {
    server.expect('/api/audit')
      .method('POST')
      .returns(200)
      .withBody({ ok: true });

    await fetch(`${server.address}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login' }),
    });

    await fetch(`${server.address}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transfer' }),
    });

    const mocks = server.listMocks();
    const auditMock = mocks.find(m => m.path === '/api/audit');
    expect(auditMock!.callCount).toBe(2);
    expect(auditMock!.calls[0].body).toEqual({ action: 'login' });
    expect(auditMock!.calls[1].body).toEqual({ action: 'transfer' });
  });

  it('verifies override invocation through verify DSL', async () => {
    const override = server.expect('/api/verify-hit')
      .method('GET')
      .returns(200)
      .withBody({ ok: true });

    expect(server.verify('/api/verify-hit')).toBe(false);
    expect(server.verifyNotCalled('/api/verify-hit')).toBe(true);

    await fetch(`${server.address}/api/verify-hit`);

    expect(server.verify('/api/verify-hit')).toBe(true);
    expect(server.verifyCount('/api/verify-hit', 1)).toBe(true);
    expect(override.isInvoked()).toBe(true);

    const details = server.explainVerification('/api/verify-hit');
    expect(details.totalCallCount).toBe(1);
    expect(details.matchedMocks).toBe(1);
  });

  it('supports cookie, bearer, and exact-body matching e2e', async () => {
    server.expect('/api/secure-transfer')
      .method('POST')
      .matchCookie('session_id', equals('abc123'))
      .matchBearerToken(startsWith('token-'))
      .matchBodyEquals({ amount: 100, currency: 'USD' })
      .returns(200)
      .withBody({ accepted: true });

    const res = await fetch(`${server.address}/api/secure-transfer`, {
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

  it('supports templating, random delay, and fault simulation e2e', async () => {
    server.expect('/api/template-user')
      .method('GET')
      .returns(200)
      .withBodyTemplate({
        message: 'Hello {{request.query.name}}',
        route: '{{request.path}}',
        tenant: '{{request.headers.x-tenant}}',
      });

    server.expect('/api/delayed')
      .method('GET')
      .returns(200)
      .withRandomDelay(30, 70)
      .withBody({ ok: true });

    server.expect('/api/empty-fault')
      .method('GET')
      .returns(200)
      .withBody({ ignored: true })
      .withFault('empty-response');

    const templateRes = await fetch(`${server.address}/api/template-user?name=QA`, {
      headers: { 'X-Tenant': 'bank-a' },
    });
    expect(templateRes.status).toBe(200);
    expect(await templateRes.json()).toEqual({
      message: 'Hello QA',
      route: '/api/template-user',
      tenant: 'bank-a',
    });

    const startedAt = Date.now();
    const delayedRes = await fetch(`${server.address}/api/delayed`);
    const elapsedMs = Date.now() - startedAt;
    expect(delayedRes.status).toBe(200);
    expect(elapsedMs).toBeGreaterThanOrEqual(25);

    const emptyRes = await fetch(`${server.address}/api/empty-fault`);
    expect(emptyRes.status).toBe(200);
    expect(await emptyRes.text()).toBe('');
  });
});
