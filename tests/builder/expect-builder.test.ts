import { describe, it, expect } from 'vitest';
import { ExpectBuilder } from '../../src/builder/expect-builder.js';
import { MockDefinition } from '../../src/core/mock-definition.js';
import { equals, startsWith } from '../../src/matchers/string-matchers.js';
import { greaterThan } from '../../src/matchers/number-matchers.js';

describe('ExpectBuilder', () => {
  function buildMock(fn: (b: ExpectBuilder) => void): MockDefinition {
    let captured: MockDefinition | undefined;
    const builder = new ExpectBuilder('/api/users', (def) => { captured = def; });
    fn(builder);
    return captured!;
  }

  it('creates a mock definition with path', () => {
    const def = buildMock(b => b.returns(200));
    expect(def.path).toBe('/api/users');
    expect(def.response.status).toBe(200);
  });

  it('sets HTTP method', () => {
    const def = buildMock(b => b.method('POST').returns(201));
    expect(def.method).toBe('POST');
    expect(def.response.status).toBe(201);
  });

  it('adds header matchers', () => {
    const def = buildMock(b =>
      b.matchHeader('Authorization', startsWith('Bearer'))
       .returns(200)
    );
    expect(def.headerMatchers.has('authorization')).toBe(true);
    expect(def.headerMatchers.get('authorization')!.match('Bearer token')).toBe(true);
  });

  it('adds query matchers', () => {
    const def = buildMock(b =>
      b.matchQuery('page', equals('1')).returns(200)
    );
    expect(def.queryMatchers.has('page')).toBe(true);
  });

  it('adds cookie matchers', () => {
    const def = buildMock(b =>
      b.matchCookie('session_id', equals('abc123')).returns(200)
    );
    expect(def.cookieMatchers.has('session_id')).toBe(true);
  });

  it('adds bearer token matcher', () => {
    const def = buildMock(b =>
      b.matchBearerToken(startsWith('token-')).returns(200)
    );
    const authMatcher = def.headerMatchers.get('authorization');
    expect(authMatcher).toBeDefined();
    expect(authMatcher!.match('Bearer token-123')).toBe(true);
    expect(authMatcher!.match('Bearer wrong')).toBe(false);
  });

  it('adds body matchers', () => {
    const def = buildMock(b =>
      b.matchBody('$.amount', greaterThan(100)).returns(200)
    );
    expect(def.bodyMatchers).toHaveLength(1);
    expect(def.bodyMatchers[0].jsonPath).toBe('$.amount');
  });

  it('adds exact body equality matcher', () => {
    const expected = { amount: 100, currency: 'USD' };
    const def = buildMock(b =>
      b.matchBodyEquals(expected).returns(200)
    );
    expect(def.bodyMatchers).toHaveLength(1);
    expect(def.bodyMatchers[0].jsonPath).toBe('$');
    expect(def.bodyMatchers[0].matcher.match(expected)).toBe(true);
    expect(def.bodyMatchers[0].matcher.match({ amount: 99, currency: 'USD' })).toBe(false);
  });

  it('sets response body via ResponseBuilder', () => {
    let captured: MockDefinition | undefined;
    const builder = new ExpectBuilder('/api/test', (def) => { captured = def; });
    builder
      .method('GET')
      .returns(200)
      .withBody({ name: 'Test' })
      .withHeaders({ 'Content-Type': 'application/json' });

    expect(captured!.response.body).toEqual({ name: 'Test' });
    expect(captured!.response.headers['Content-Type']).toBe('application/json');
  });

  it('sets response delay', () => {
    let captured: MockDefinition | undefined;
    const builder = new ExpectBuilder('/api/slow', (def) => { captured = def; });
    builder.returns(200).withDelay(500);
    expect(captured!.response.delay).toBe(500);
  });

  it('sets random delay, templated body, and fault', () => {
    let captured: MockDefinition | undefined;
    const builder = new ExpectBuilder('/api/runtime', (def) => { captured = def; });
    builder
      .returns(200)
      .withRandomDelay(50, 100)
      .withBodyTemplate({ message: 'Hello {{request.path}}' })
      .withFault('empty-response');

    expect(captured!.response.delayRange).toEqual({ min: 50, max: 100 });
    expect(captured!.response.template).toBe(true);
    expect(captured!.response.fault).toBe('empty-response');
  });

  it('exposes invocation state through ResponseBuilder and MockDefinition', () => {
    let captured: MockDefinition | undefined;
    const builder = new ExpectBuilder('/api/invoked', (def) => { captured = def; });
    const responseBuilder = builder.returns(200);

    expect(responseBuilder.isInvoked()).toBe(false);
    expect(captured!.isInvoked()).toBe(false);

    captured!.recordCall({
      method: 'GET',
      path: '/api/invoked',
      headers: {},
      cookies: {},
      query: {},
      body: null,
      timestamp: Date.now(),
    });

    expect(responseBuilder.isInvoked()).toBe(true);
    expect(captured!.isInvoked()).toBe(true);
  });

  it('assigns override priority by default', () => {
    const def = buildMock(b => b.returns(200));
    expect(def.priority).toBe('override');
  });

  it('generates unique IDs', () => {
    const def1 = buildMock(b => b.returns(200));
    const def2 = buildMock(b => b.returns(200));
    expect(def1.id).not.toBe(def2.id);
  });
});
