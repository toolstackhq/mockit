import { describe, it, expect } from 'vitest';
import { buildProxyUrl, proxyRequest } from '../../src/shared/proxy.js';

describe('proxy helper', () => {
  it('builds proxy URLs with query parameters', () => {
    const url = buildProxyUrl('http://upstream.test', '/api/users', { tenant: 'bank-a', page: '1' });
    expect(url).toBe('http://upstream.test/api/users?tenant=bank-a&page=1');
  });

  it('forwards requests and parses JSON responses', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub: typeof fetch = async (input, init) => {
      fetchCalls.push({
        url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
        init,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        statusText: 'Created',
        headers: {
          'Content-Type': 'application/json',
          'X-Upstream': 'yes',
        },
      });
    };

    const proxied = await proxyRequest('http://upstream.test', {
      method: 'POST',
      path: '/api/users',
      query: { tenant: 'bank-a' },
      headers: {
        'content-type': 'application/json',
        host: 'mockit.local',
      },
      rawBody: '{"name":"Jane"}',
    }, fetchStub);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('http://upstream.test/api/users?tenant=bank-a');
    expect(fetchCalls[0].init?.method).toBe('POST');
    expect(fetchCalls[0].init?.body).toBe('{"name":"Jane"}');
    expect((fetchCalls[0].init?.headers as Record<string, string>).host).toBeUndefined();
    expect(proxied.statusText).toBe('Created');
    expect(proxied.response.status).toBe(201);
    expect(proxied.response.body).toEqual({ ok: true });
    expect(proxied.response.headers['x-upstream']).toBe('yes');
  });

  it('preserves text bodies and skips request bodies for GET', async () => {
    const fetchStub: typeof fetch = async (_input, init) => {
      expect(init?.body).toBeUndefined();
      return new Response('plain-text', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    };

    const proxied = await proxyRequest('http://upstream.test', {
      method: 'GET',
      path: '/health',
      query: {},
      headers: {},
      rawBody: 'ignored',
    }, fetchStub);

    expect(proxied.response.body).toBe('plain-text');
  });
});
