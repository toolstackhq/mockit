import type { HttpMethod, Matcher } from '../core/types.js';
import { MockDefinition } from '../core/mock-definition.js';
import { ResponseBuilder } from './response-builder.js';

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

  matchQuery(name: string, matcher: Matcher<string>): this {
    this.definition.queryMatchers.set(name, matcher);
    return this;
  }

  matchBody(jsonPath: string, matcher: Matcher<any>): this {
    this.definition.bodyMatchers.push({ jsonPath, matcher });
    return this;
  }

  returns(status: number): ResponseBuilder {
    this.definition.response.status = status;
    this.onBuild(this.definition);
    return new ResponseBuilder(this.definition);
  }
}
