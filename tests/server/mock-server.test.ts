import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../../src/server/mock-server.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';

describe('MockServer', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = new MockServer({ port: 0 });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('starts and stops without error', async () => {
    const { port } = await server.start();
    expect(port).toBeGreaterThan(0);
    await server.stop();
  });

  it('returns 501 when no mock matches', async () => {
    await server.start();
    const res = await fetch(`${server.address}/api/unknown`);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('No mock matched');
  });

  it('returns mocked response for GET', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([{ id: 1, name: 'Test User' }]);

    await server.start();
    const res = await fetch(`${server.address}/api/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 1, name: 'Test User' }]);
  });

  it('returns mocked response for POST with body matching', async () => {
    server.expect('/api/users')
      .method('POST')
      .matchBody('$.name', equals('John'))
      .returns(201)
      .withBody({ id: 2, name: 'John' });

    await server.start();
    const res = await fetch(`${server.address}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('John');
  });

  it('matches path parameters', async () => {
    server.expect('/api/users/:id')
      .method('GET')
      .returns(200)
      .withBody({ id: 42, name: 'User 42' });

    await server.start();
    const res = await fetch(`${server.address}/api/users/42`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(42);
  });

  it('matches query parameters', async () => {
    server.expect('/api/users')
      .method('GET')
      .matchQuery('role', equals('admin'))
      .returns(200)
      .withBody([{ id: 1, role: 'admin' }]);

    await server.start();
    const res = await fetch(`${server.address}/api/users?role=admin`);
    expect(res.status).toBe(200);
  });

  it('matches headers', async () => {
    server.expect('/api/secure')
      .method('GET')
      .matchHeader('Authorization', startsWith('Bearer'))
      .returns(200)
      .withBody({ secure: true });

    await server.start();

    const unauthorized = await fetch(`${server.address}/api/secure`);
    expect(unauthorized.status).toBe(501);

    const authorized = await fetch(`${server.address}/api/secure`, {
      headers: { Authorization: 'Bearer my-token' },
    });
    expect(authorized.status).toBe(200);
  });

  it('sets custom response headers', async () => {
    server.expect('/api/test')
      .returns(200)
      .withHeaders({ 'X-Custom': 'hello' })
      .withBody({});

    await server.start();
    const res = await fetch(`${server.address}/api/test`);
    expect(res.headers.get('X-Custom')).toBe('hello');
  });

  it('tracks call count', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([]);

    await server.start();
    await fetch(`${server.address}/api/users`);
    await fetch(`${server.address}/api/users`);

    const mocks = server.listMocks();
    expect(mocks[0].callCount).toBe(2);
    expect(mocks[0].calls).toHaveLength(2);
  });

  it('resets overrides but keeps defaults', async () => {
    server.expect('/api/users')
      .method('GET')
      .returns(200)
      .withBody([]);

    server.resetOverrides();
    expect(server.listMocks()).toHaveLength(0);
  });

  it('throws if started twice', async () => {
    await server.start();
    await expect(server.start()).rejects.toThrow('already running');
  });
});
