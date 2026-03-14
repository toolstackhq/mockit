import { afterEach, describe, expect, it } from 'vitest';
import { RemoteMockServer } from '../../src/remote/remote-mock-server.js';

describe('RemoteMockServer unit helpers', () => {
  const nativeFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = nativeFetch;
  });

  it('sends create/list/reset requests to admin endpoints', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });

      if (String(url).endsWith('/_mockit/api/overrides') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: '1', path: '/api/users', response: { status: 201 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (String(url).endsWith('/_mockit/api/overrides') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      if (String(url).endsWith('/_mockit/api/history') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const remote = new RemoteMockServer('http://mock.test/');

    const created = await remote.createOverride({
      path: '/api/users',
      response: { status: 201 },
    });
    expect(created.id).toBe('1');

    await remote.listOverrides();
    await remote.listRequests();
    await remote.listUnmatchedRequests();
    await remote.pendingMocks();
    await remote.resetOverrides();
    await remote.clearHistory();
    await remote.resetAll();

    expect(calls.some((call) => call.url === 'http://mock.test/_mockit/api/overrides')).toBe(true);
    expect(calls.some((call) => call.url === 'http://mock.test/_mockit/api/history')).toBe(true);
  });

  it('filters matching mocks for verification and normalizes ANY methods', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify([
      { id: '1', path: '/api/users', method: 'ANY', priority: 'override', callCount: 2 },
      { id: '2', path: '/api/users', method: 'GET', priority: 'default', callCount: 0 },
      { id: '3', path: '/api/other', method: 'GET', priority: 'override', callCount: 4 },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const remote = new RemoteMockServer('http://mock.test');

    expect(await remote.verify('/api/users')).toBe(true);
    expect(await remote.verifyCount('/api/users', 2, { id: '1' })).toBe(true);
    expect(await remote.verifyNotCalled('/api/users', { method: 'GET', priority: 'default' })).toBe(true);
    expect(await remote.isDone()).toBe(false);

    const explanation = await remote.explainVerification('/api/users');
    expect(explanation.matchedMocks).toBe(2);
    expect(explanation.totalCallCount).toBe(2);
    expect(explanation.mocks[0].method).toBeUndefined();
  });

  it('throws readable errors when remote endpoints fail', async () => {
    globalThis.fetch = async (_url: string | URL, init?: RequestInit) => {
      const status = init?.method === 'DELETE' ? 500 : 400;
      return new Response('bad request', { status, statusText: 'Bad Request' });
    };

    const remote = new RemoteMockServer('http://mock.test');

    await expect(remote.listOverrides()).rejects.toThrow('RemoteMockServer request failed (400): bad request');
    await expect(remote.resetOverrides()).rejects.toThrow('RemoteMockServer request failed (500): bad request');
  });
});
