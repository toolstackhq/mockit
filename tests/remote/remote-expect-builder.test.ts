import { describe, expect, it } from 'vitest';
import { equals, startsWith } from '../../src/matchers/index.js';
import { RemoteExpectBuilder } from '../../src/remote/remote-expect-builder.js';

describe('RemoteExpectBuilder', () => {
  it('serializes all matcher types into a remote request', () => {
    const builder = new RemoteExpectBuilder('/api/login', {} as any);

    const request = builder
      .method('POST')
      .matchHeader('x-tenant', equals('bank-a'))
      .matchCookie('session_id', startsWith('abc'))
      .matchBearerToken(startsWith('token-'))
      .matchQuery('page', equals('1'))
      .matchBody('$.amount', equals(100))
      .matchBodyEquals({ role: 'admin' })
      .count(2)
      .returns(403)
      .build();

    expect(request).toEqual({
      path: '/api/login',
      method: 'POST',
      count: 2,
      matchers: {
        headers: {
          'x-tenant': { equals: 'bank-a' },
          authorization: { bearerToken: { startsWith: 'token-' } },
        },
        cookies: {
          session_id: { startsWith: 'abc' },
        },
        query: {
          page: { equals: '1' },
        },
        body: [
          { jsonPath: '$.amount', matcher: { equals: 100 } },
        ],
        bodyEquals: { role: 'admin' },
      },
      response: {
        status: 403,
      },
    });
  });

  it('rejects invalid count values', () => {
    const builder = new RemoteExpectBuilder('/api/login', {} as any);
    expect(() => builder.count(-1)).toThrow(/non-negative integer/);
  });
});
