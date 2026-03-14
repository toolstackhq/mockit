import { expect } from '@playwright/test';
import {
  any,
  contains,
  equals,
  greaterThan,
  startsWith,
} from '../../src/index.js';
import { test } from './support/mockit-server.fixture.js';

test('serves defaults and swagger mocks and falls back after reset', async ({ request, mockServer, remoteMock }) => {
  const defaultUsers = await request.get(`${mockServer.address}/api/users`);
  expect(defaultUsers.status()).toBe(200);
  expect(await defaultUsers.json()).toEqual([{ id: 1, name: 'Default User' }]);

  const swaggerPets = await request.get(`${mockServer.address}/pets`);
  expect(swaggerPets.status()).toBe(200);
  expect(await swaggerPets.json()).toEqual([{ id: 1, name: 'Buddy', tag: 'default-tag' }]);

  await remoteMock.expect('/api/users')
    .method('GET')
    .count(0)
    .returns(200)
    .withBody([{ id: 99, name: 'Remote Override User' }])
    .apply();

  const overriddenUsers = await request.get(`${mockServer.address}/api/users`);
  expect(overriddenUsers.status()).toBe(200);
  expect(await overriddenUsers.json()).toEqual([{ id: 99, name: 'Remote Override User' }]);

  await remoteMock.resetOverrides();

  const resetUsers = await request.get(`${mockServer.address}/api/users`);
  expect(resetUsers.status()).toBe(200);
  expect(await resetUsers.json()).toEqual([{ id: 1, name: 'Default User' }]);
});

test('matches full request constraints and exhausts finite overrides', async ({ request, mockServer, remoteMock }) => {
  await remoteMock.expect('/api/payments')
    .method('POST')
    .count(1)
    .matchHeader('x-tenant', equals('bank-a'))
    .matchCookie('session_id', equals('abc123'))
    .matchBearerToken(startsWith('token-'))
    .matchQuery('mode', contains('qa'))
    .matchBody('$.amount', greaterThan(100))
    .returns(403)
    .withHeaders({ 'x-mock-source': 'playwright-api' })
    .withBody({ message: 'blocked' })
    .apply();

  expect(await remoteMock.isDone()).toBe(false);
  expect(await remoteMock.pendingMocks()).toHaveLength(1);

  const first = await request.post(`${mockServer.address}/api/payments?mode=qa-flow`, {
    headers: {
      'x-tenant': 'bank-a',
      authorization: 'Bearer token-42',
      cookie: 'session_id=abc123',
      'content-type': 'application/json',
    },
    data: { amount: 200 },
  });

  expect(first.status()).toBe(403);
  expect(first.headers()['x-mock-source']).toBe('playwright-api');
  expect(await first.json()).toEqual({ message: 'blocked' });

  expect(await remoteMock.isDone()).toBe(true);
  expect(await remoteMock.pendingMocks()).toHaveLength(0);
  expect(await remoteMock.verify('/api/payments')).toBe(true);
  expect(await remoteMock.verifyCount('/api/payments', 1)).toBe(true);

  const second = await request.post(`${mockServer.address}/api/payments?mode=qa-flow`, {
    headers: {
      'x-tenant': 'bank-a',
      authorization: 'Bearer token-42',
      cookie: 'session_id=abc123',
      'content-type': 'application/json',
    },
    data: { amount: 200 },
  });

  expect(second.status()).toBe(501);

  const explanation = await remoteMock.explainVerification('/api/payments');
  expect(explanation.totalCallCount).toBe(1);

  const requests = await remoteMock.listRequests();
  expect(requests).toHaveLength(2);

  const unmatched = await remoteMock.listUnmatchedRequests();
  expect(unmatched).toHaveLength(1);
});

test('supports sequences, templating, delays, and empty responses', async ({ request, mockServer, remoteMock }) => {
  await remoteMock.expect('/api/orders/123')
    .method('GET')
    .count(2)
    .returns(202)
    .withDelay(35)
    .withBodyTemplate({
      status: 'processing',
      tenant: '{{request.headers.x-tenant}}',
      attempt: '{{request.query.attempt}}',
    })
    .thenReply(200)
    .withBody({ status: 'complete' })
    .apply();

  await remoteMock.expect('/api/empty')
    .method('GET')
    .count(0)
    .returns(200)
    .withBody({ ignored: true })
    .withFault('empty-response')
    .apply();

  const startedAt = Date.now();
  const first = await request.get(`${mockServer.address}/api/orders/123?attempt=1`, {
    headers: { 'x-tenant': 'bank-a' },
  });
  const elapsedMs = Date.now() - startedAt;

  expect(first.status()).toBe(202);
  expect(elapsedMs).toBeGreaterThanOrEqual(20);
  expect(await first.json()).toEqual({
    status: 'processing',
    tenant: 'bank-a',
    attempt: '1',
  });

  const second = await request.get(`${mockServer.address}/api/orders/123?attempt=2`, {
    headers: { 'x-tenant': 'bank-a' },
  });
  expect(second.status()).toBe(200);
  expect(await second.json()).toEqual({ status: 'complete' });

  const empty = await request.get(`${mockServer.address}/api/empty`);
  expect(empty.status()).toBe(200);
  expect(await empty.text()).toBe('');
});

test('exposes remote admin helpers for optional and unlimited overrides', async ({ request, mockServer, remoteMock }) => {
  await remoteMock.expect('/api/analytics')
    .method('POST')
    .count(0)
    .matchHeader('x-request-id', any())
    .returns(202)
    .optionally()
    .withBody({ queued: true })
    .apply();

  const overrides = await remoteMock.listOverrides();
  expect(overrides).toHaveLength(1);
  expect(overrides[0].path).toBe('/api/analytics');

  expect(await remoteMock.pendingMocks()).toHaveLength(0);
  expect(await remoteMock.isDone()).toBe(true);

  const analytics = await request.post(`${mockServer.address}/api/analytics`, {
    headers: { 'x-request-id': 'req-100' },
  });
  expect(analytics.status()).toBe(202);
  expect(await analytics.json()).toEqual({ queued: true });

  const allMocks = await remoteMock.listMocks();
  expect(allMocks.some((mock) => mock.priority === 'swagger')).toBe(true);
  expect(allMocks.some((mock) => mock.priority === 'default')).toBe(true);

  const requests = await remoteMock.listRequests();
  expect(requests).toHaveLength(1);
  expect(requests[0].matched).toBe(true);

  await request.get(`${mockServer.address}/api/unmatched-path`);
  expect(await remoteMock.listUnmatchedRequests()).toHaveLength(1);

  await remoteMock.clearHistory();
  expect(await remoteMock.listRequests()).toHaveLength(0);
});
