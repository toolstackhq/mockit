import http from 'node:http';
import https from 'node:https';
import { describe, it, expect, afterEach } from 'vitest';
import axios from 'axios';
import { resolve } from 'node:path';
import { HttpInterceptor } from '../../src/interceptor/http-interceptor.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';

describe('HttpInterceptor', () => {
  let interceptor: HttpInterceptor;
  const nativeFetch = globalThis.fetch;
  const servers: http.Server[] = [];

  afterEach(async () => {
    if (interceptor?.isActive) {
      interceptor.disable();
    }
    globalThis.fetch = nativeFetch;
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClose) => {
      server.close(() => resolveClose());
    })));
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

  it('intercepts node:http client requests', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/http-users')
      .method('POST')
      .matchBody('$.name', equals('Core Client'))
      .returns(201)
      .withBody({ ok: true, via: 'http' });

    interceptor.enable();

    const payload = JSON.stringify({ name: 'Core Client' });
    const responseBody = await new Promise<string>((resolveResponse, reject) => {
      const req = http.request('http://api.internal/api/http-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse(data));
      });

      req.on('error', reject);
      req.end(payload);
    });

    expect(JSON.parse(responseBody)).toEqual({ ok: true, via: 'http' });
  });

  it('intercepts axios requests in Node', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/axios-users')
      .method('GET')
      .matchHeader('x-client', equals('axios'))
      .returns(200)
      .withBody([{ id: 1, name: 'Axios User' }]);

    interceptor.enable();

    const response = await axios.get('http://api.internal/api/axios-users', {
      headers: {
        'x-client': 'axios',
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toEqual([{ id: 1, name: 'Axios User' }]);
  });

  it('intercepts https client requests', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/https-users')
      .method('GET')
      .returns(200)
      .withBody({ secure: true });

    interceptor.enable();

    const responseBody = await new Promise<string>((resolveResponse, reject) => {
      const req = https.request('https://api.internal/api/https-users', (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse(data));
      });

      req.on('error', reject);
      req.end();
    });

    expect(JSON.parse(responseBody)).toEqual({ secure: true });
  });

  it('passes through unmatched node:http requests', async () => {
    const upstream = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ passthrough: req.url }));
    });
    servers.push(upstream);
    await new Promise<void>((resolveListen) => upstream.listen(0, '127.0.0.1', () => resolveListen()));
    const address = upstream.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address');
    }

    interceptor = new HttpInterceptor();
    interceptor.enable();

    const body = await new Promise<string>((resolveResponse, reject) => {
      const req = http.get(`http://127.0.0.1:${address.port}/api/live?mode=test`, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse(data));
      });
      req.on('error', reject);
    });

    expect(JSON.parse(body)).toEqual({ passthrough: '/api/live?mode=test' });
    expect(interceptor.listUnmatchedRequests()).toHaveLength(1);
  });

  it('passes through unmatched POST requests with bodies', async () => {
    const upstream = http.createServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, body }));
      });
    });
    servers.push(upstream);
    await new Promise<void>((resolveListen) => upstream.listen(0, '127.0.0.1', () => resolveListen()));
    const address = upstream.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address');
    }

    interceptor = new HttpInterceptor();
    interceptor.enable();

    const payload = JSON.stringify({ name: 'Passthrough' });
    const body = await new Promise<string>((resolveResponse, reject) => {
      const req = http.request(`http://127.0.0.1:${address.port}/api/live-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse(data));
      });
      req.on('error', reject);
      req.end(payload);
    });

    expect(JSON.parse(body)).toEqual({ method: 'POST', body: payload });
  });

  it('blocks unmatched node:http requests in fail mode', async () => {
    interceptor = new HttpInterceptor({ onUnhandled: 'fail' });
    interceptor.enable();

    await expect(new Promise<void>((resolveRequest, reject) => {
      const req = http.get('http://api.internal/api/fail-http');
      req.on('response', () => resolveRequest());
      req.on('error', reject);
    })).rejects.toThrow(/blocked unhandled request/i);
  });

  it('proxies unmatched node:http requests', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe('http://upstream.test/api/proxy-http?tenant=bank-a');
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ proxied: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', 'X-Proxy': 'yes' },
      });
    };

    interceptor = new HttpInterceptor({
      onUnhandled: 'proxy',
      proxyBaseUrl: 'http://upstream.test',
      recordProxiedResponses: true,
    });
    interceptor.enable();

    const body = await new Promise<string>((resolveResponse, reject) => {
      const req = http.get('http://api.internal/api/proxy-http?tenant=bank-a', (res) => {
        expect(res.statusCode).toBe(202);
        expect(res.headers['x-proxy']).toBe('yes');
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse(data));
      });
      req.on('error', reject);
    });

    expect(JSON.parse(body)).toEqual({ proxied: true });
    expect(interceptor.listRequests()[0].proxied).toBe(true);
  });

  it('supports node request header mutation and timeout callback', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/mutable')
      .method('POST')
      .matchHeader('x-mode', equals('mutable'))
      .matchBody('$.ok', equals(true))
      .returns(200)
      .withBody({ ok: true });

    interceptor.enable();

    let timeoutCalled = false;
    const responseBody = await new Promise<string>((resolveResponse, reject) => {
      const req = http.request({
        protocol: 'http:',
        hostname: 'api.internal',
        path: '/api/mutable',
        method: 'POST',
        headers: new Headers({ 'x-ignored': '1' }),
      }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse(data));
      });

      req.removeHeader('x-ignored');
      req.setHeader('x-mode', 'mutable');
      expect(req.getHeader('x-mode')).toBe('mutable');
      req.setTimeout(5, () => {
        timeoutCalled = true;
      });
      req.write(Buffer.from('{"ok":'));
      req.end(new Uint8Array(Buffer.from('true}')));
      req.on('error', reject);
    });

    expect(JSON.parse(responseBody)).toEqual({ ok: true });
    expect(timeoutCalled).toBe(true);
  });

  it('returns empty mocked node responses with rendered headers', async () => {
    interceptor = new HttpInterceptor();
    interceptor.expect('/api/no-content')
      .method('GET')
      .returns(204)
      .withHeaders({ 'X-Mock': 'yes' })
      .withFault('empty-response');

    interceptor.enable();

    const details = await new Promise<{ statusCode?: number; body: string; header: string | string[] | undefined }>((resolveResponse, reject) => {
      const req = http.get('http://api.internal/api/no-content', (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolveResponse({
          statusCode: res.statusCode,
          body: data,
          header: res.headers['x-mock'],
        }));
      });
      req.on('error', reject);
    });

    expect(details.statusCode).toBe(204);
    expect(details.body).toBe('');
    expect(details.header).toBe('yes');
  });

  it('emits abort and destroy errors on intercepted node requests', async () => {
    interceptor = new HttpInterceptor();
    interceptor.enable();

    const aborted = await new Promise<Error>((resolveError) => {
      const req = http.request('http://api.internal/api/abort-me');
      req.on('error', (error) => resolveError(error as Error));
      req.abort();
    });
    expect(aborted.message).toContain('socket hang up');

    const destroyed = await new Promise<Error>((resolveError) => {
      const req = http.request('http://api.internal/api/destroy-me');
      req.on('error', (error) => resolveError(error as Error));
      req.destroy(new Error('destroyed'));
    });
    expect(destroyed.message).toContain('destroyed');
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
