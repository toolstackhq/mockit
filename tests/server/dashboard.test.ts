import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { MockServer, equals, startsWith } from '../../src/index.js';

describe('Dashboard', () => {
  let server: MockServer;

  beforeAll(async () => {
    server = new MockServer({ port: 0 });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  afterEach(() => {
    server.resetAll();
  });

  describe('GET /_mockit', () => {
    it('returns HTML dashboard', async () => {
      const res = await fetch(`${server.address}/_mockit`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('MockIt Dashboard');
    });

    it('shows "No mocks registered" when empty', async () => {
      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('No mocks registered yet');
    });

    it('displays registered mock info', async () => {
      server.expect('/api/users')
        .method('GET')
        .returns(200)
        .withBody([{ id: 1 }]);

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('GET');
      expect(html).toContain('/api/users');
      expect(html).toContain('200');
    });

    it('shows matcher details', async () => {
      server.expect('/api/secure')
        .method('POST')
        .matchHeader('authorization', startsWith('Bearer'))
        .matchQuery('page', equals('1'))
        .matchBody('$.name', equals('John'))
        .returns(201)
        .withBody({ ok: true });

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('header');
      expect(html).toContain('authorization');
      expect(html).toContain("startsWith('Bearer')");
      expect(html).toContain('query');
      expect(html).toContain('body');
      expect(html).toContain('$.name');
    });

    it('includes Try it out button for each mock', async () => {
      server.expect('/api/users')
        .method('GET')
        .returns(200)
        .withBody([]);

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('Try it out');
      expect(html).toContain('try-panel');
      expect(html).toContain('send-btn');
    });

    it('pre-fills path in Try it out panel', async () => {
      server.expect('/api/orders/:id')
        .method('GET')
        .returns(200)
        .withBody({});

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('value="/api/orders/:id"');
    });

    it('pre-fills header values from matcher hints', async () => {
      server.expect('/api/secure')
        .method('GET')
        .matchHeader('x-api-key', equals('secret'))
        .returns(200)
        .withBody({});

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('x-api-key');
      expect(html).toContain('secret');
    });

    it('pre-fills body from body matchers', async () => {
      server.expect('/api/login')
        .method('POST')
        .matchBody('$.email', equals('test@bank.com'))
        .returns(200)
        .withBody({ token: 'jwt' });

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('test@bank.com');
      expect(html).toContain('email');
    });

    it('groups mocks by priority', async () => {
      server.expect('/api/test')
        .returns(200)
        .withBody({});

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('Override');
    });

    it('shows call count after requests are made', async () => {
      server.expect('/api/counter')
        .method('GET')
        .returns(200)
        .withBody({ n: 1 });

      await fetch(`${server.address}/api/counter`);
      await fetch(`${server.address}/api/counter`);

      const res = await fetch(`${server.address}/_mockit`);
      const html = await res.text();
      expect(html).toContain('2 calls');
    });
  });

  describe('GET /_mockit/api/mocks', () => {
    it('returns JSON array', async () => {
      const res = await fetch(`${server.address}/_mockit/api/mocks`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    it('includes mock details in JSON', async () => {
      server.expect('/api/items')
        .method('DELETE')
        .matchHeader('x-api-key', equals('secret'))
        .returns(204);

      const res = await fetch(`${server.address}/_mockit/api/mocks`);
      const json = await res.json();
      expect(json).toHaveLength(1);
      expect(json[0].method).toBe('DELETE');
      expect(json[0].path).toBe('/api/items');
      expect(json[0].priority).toBe('override');
      expect(json[0].response.status).toBe(204);
      expect(json[0].matchers.headers['x-api-key']).toBe("equals('secret')");
    });

    it('tracks call count in JSON', async () => {
      server.expect('/api/ping')
        .returns(200)
        .withBody('pong');

      await fetch(`${server.address}/api/ping`);

      const res = await fetch(`${server.address}/_mockit/api/mocks`);
      const json = await res.json();
      expect(json[0].callCount).toBe(1);
    });
  });

  it('dashboard does not interfere with mock resolution', async () => {
    server.expect('/_mockit/special')
      .method('POST')
      .returns(200)
      .withBody({ special: true });

    // Dashboard still works
    const dashRes = await fetch(`${server.address}/_mockit`);
    expect(dashRes.status).toBe(200);
    expect(await dashRes.text()).toContain('MockIt Dashboard');

    // Mock still works via POST (dashboard only intercepts GET /_mockit)
    const mockRes = await fetch(`${server.address}/_mockit/special`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(mockRes.status).toBe(200);
    expect(await mockRes.json()).toEqual({ special: true });
  });
});
