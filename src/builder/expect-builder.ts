import type { HttpMethod, Matcher } from '../core/types.js';
import { MockDefinition } from '../core/mock-definition.js';
import { ResponseBuilder } from './response-builder.js';
import { equalsJson } from '../matchers/body-matchers.js';

export class ExpectBuilder {
  private definition: MockDefinition;

  constructor(path: string, private onBuild: (def: MockDefinition) => void) {
    this.definition = new MockDefinition(path);
  }

  method(method: HttpMethod): this {
    this.definition.method = method;
    return this;
  }

  matchHeader(name: string, matcher: Matcher<string>): this {
    this.definition.headerMatchers.set(name.toLowerCase(), matcher);
    return this;
  }

  matchCookie(name: string, matcher: Matcher<string>): this {
    this.definition.cookieMatchers.set(name.toLowerCase(), matcher);
    return this;
  }

  matchBearerToken(matcher: Matcher<string>): this {
    return this.matchHeader('authorization', {
      name: `bearer(${matcher.name})`,
      match: (value: string) => {
        const idx = value.indexOf(' ');
        if (idx <= 0) return false;
        const scheme = value.slice(0, idx);
        if (scheme.toLowerCase() !== 'bearer') return false;
        const token = value.slice(idx + 1).trim();
        return token.length > 0 && matcher.match(token);
      },
    });
  }

  matchQuery(name: string, matcher: Matcher<string>): this {
    this.definition.queryMatchers.set(name, matcher);
    return this;
  }

  matchBody(jsonPath: string, matcher: Matcher<any>): this {
    this.definition.bodyMatchers.push({ jsonPath, matcher });
    return this;
  }

  matchBodyEquals(expected: any): this {
    return this.matchBody('$', equalsJson(expected));
  }

  count(expectedCalls: number): this {
    if (!Number.isInteger(expectedCalls) || expectedCalls < 0) {
      throw new Error('count() expects a non-negative integer');
    }

    if (expectedCalls === 0) {
      this.definition.persisted = true;
      this.definition.remainingUses = undefined;
      return this;
    }

    this.definition.persisted = false;
    this.definition.remainingUses = expectedCalls;
    return this;
  }

  returns(status: number): ResponseBuilder {
    this.definition.response.status = status;
    this.onBuild(this.definition);
    return new ResponseBuilder(this.definition);
  }
}
