import type { HttpMethod, Matcher, RemoteOverrideRequest } from '../core/types.js';
import { equalsJson } from '../matchers/body-matchers.js';
import { assertSerializableMatcher } from '../matchers/serializable-matcher.js';
import type { RemoteMockServer } from './remote-mock-server.js';
import { RemoteResponseBuilder } from './remote-response-builder.js';

export class RemoteExpectBuilder {
  private request: RemoteOverrideRequest;

  constructor(path: string, private client: RemoteMockServer) {
    this.request = {
      path,
      response: {
        status: 200,
      },
    };
  }

  method(method: HttpMethod): this {
    this.request.method = method;
    return this;
  }

  matchHeader(name: string, matcher: Matcher<string>): this {
    const serializable = assertSerializableMatcher(matcher, 'matchHeader()');
    this.request.matchers ??= {};
    this.request.matchers.headers ??= {};
    this.request.matchers.headers[name.toLowerCase()] = serializable.serialize();
    return this;
  }

  matchCookie(name: string, matcher: Matcher<string>): this {
    const serializable = assertSerializableMatcher(matcher, 'matchCookie()');
    this.request.matchers ??= {};
    this.request.matchers.cookies ??= {};
    this.request.matchers.cookies[name.toLowerCase()] = serializable.serialize();
    return this;
  }

  matchBearerToken(matcher: Matcher<string>): this {
    const serializable = assertSerializableMatcher(matcher, 'matchBearerToken()');
    this.request.matchers ??= {};
    this.request.matchers.headers ??= {};
    this.request.matchers.headers.authorization = {
      bearerToken: serializable.serialize(),
    };
    return this;
  }

  matchQuery(name: string, matcher: Matcher<string>): this {
    const serializable = assertSerializableMatcher(matcher, 'matchQuery()');
    this.request.matchers ??= {};
    this.request.matchers.query ??= {};
    this.request.matchers.query[name] = serializable.serialize();
    return this;
  }

  matchBody(jsonPath: string, matcher: Matcher<any>): this {
    const serializable = assertSerializableMatcher(matcher, 'matchBody()');
    this.request.matchers ??= {};
    this.request.matchers.body ??= [];
    this.request.matchers.body.push({
      jsonPath,
      matcher: serializable.serialize(),
    });
    return this;
  }

  matchBodyEquals(expected: any): this {
    this.request.matchers ??= {};
    this.request.matchers.bodyEquals = equalsJson(expected).serialize().equals;
    return this;
  }

  count(expectedCalls: number): this {
    if (!Number.isInteger(expectedCalls) || expectedCalls < 0) {
      throw new Error('count() expects a non-negative integer');
    }

    this.request.count = expectedCalls;
    return this;
  }

  returns(status: number): RemoteResponseBuilder {
    this.request.response.status = status;
    return new RemoteResponseBuilder(this.client, this.request);
  }
}
