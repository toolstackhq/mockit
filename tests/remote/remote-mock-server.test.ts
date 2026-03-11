import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { MockServer } from '../../src/server/mock-server.js';
import { RemoteMockServer } from '../../src/remote/remote-mock-server.js';
import { any, contains, equals, greaterThan, startsWith } from '../../src/index.js';

describe('RemoteMockServer', () => {
  let server: MockServer;
  let remote: RemoteMockServer;

  beforeEach(async () => {
    server = new MockServer({ port: 0 });
    await server.start();
    remote = new RemoteMockServer(server.address);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('creates remote overrides with the same matcher and response DSL', async () => {
    const created = await remote.expect('/api/login')
      .method('POST')
      .count(1)
      .matchHeader('x-tenant', equals('bank-a'))
      .matchBearerToken(startsWith('token-'))
      .matchQuery('mode', contains('test'))
      .matchBody('$.amount', greaterThan(100))
      .returns(403)
      .withHeaders({ 'x-mock-source': 'remote' })
      .withBody({ message: 'unauthorized' })
      .apply();

    expect(created).toMatchObject({
      path: '/api/login',
      response: { status: 403 },
      remainingUses: 1,
    });

    const res = await fetch(`${server.address}/api/login?mode=qa-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': 'bank-a',
        Authorization: 'Bearer token-42',
      },
      body: JSON.stringify({ amount: 200 }),
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('x-mock-source')).toBe('remote');
    expect(await res.json()).toEqual({ message: 'unauthorized' });

    const second = await fetch(`${server.address}/api/login?mode=qa-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': 'bank-a',
        Authorization: 'Bearer token-42',
      },
      body: JSON.stringify({ amount: 200 }),
    });

    expect(second.status).toBe(501);
  });

  it('supports sequential replies, file bodies, and remote verification helpers', async () => {
    const bodyPath = resolve(import.meta.dirname, '../builder/fixtures/body.json');

    const created = await remote.expect('/api/retry')
      .method('GET')
      .count(2)
      .returns(500)
      .withBodyFromFile(bodyPath)
      .thenReply(200)
      .withBody({ ok: true })
      .apply();

    expect(await remote.verify('/api/retry')).toBe(false);
    expect(await remote.verifyNotCalled('/api/retry')).toBe(true);

    const first = await fetch(`${server.address}/api/retry`);
    const second = await fetch(`${server.address}/api/retry`);

    expect(first.status).toBe(500);
    expect(await first.json()).toEqual({ loaded: true, source: 'fixture' });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true });

    expect(await remote.verify('/api/retry')).toBe(true);
    expect(await remote.verifyCount('/api/retry', 2)).toBe(true);
    expect(await remote.verifyNotCalled('/api/retry')).toBe(false);
    expect(await remote.isDone()).toBe(true);

    const details = await remote.explainVerification('/api/retry', { id: created.id });
    expect(details.matchedMocks).toBe(1);
    expect(details.totalCallCount).toBe(2);
  });

  it('exposes journal and override helpers for external test runners', async () => {
    await remote.expect('/api/analytics')
      .method('POST')
      .count(0)
      .matchHeader('x-request-id', any())
      .returns(202)
      .optionally()
      .withBody({ queued: true })
      .apply();

    expect(await remote.listOverrides()).toHaveLength(1);
    expect(await remote.pendingMocks()).toHaveLength(0);

    const res = await fetch(`${server.address}/api/analytics`, {
      method: 'POST',
      headers: {
        'x-request-id': 'req-123',
      },
    });

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ queued: true });

    const requests = await remote.listRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].matched).toBe(true);

    await fetch(`${server.address}/api/unmatched`);
    const unmatched = await remote.listUnmatchedRequests();
    expect(unmatched).toHaveLength(1);

    await remote.clearJournal();
    expect(await remote.listRequests()).toHaveLength(0);

    await remote.resetOverrides();
    expect(await remote.listOverrides()).toHaveLength(0);
  });
});
