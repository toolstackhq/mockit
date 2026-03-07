import { readFileSync } from 'node:fs';
import { MockDefinition } from '../core/mock-definition.js';

export class ResponseBuilder {
  constructor(private definition: MockDefinition) {}

  withHeaders(headers: Record<string, string>): this {
    Object.assign(this.definition.response.headers, headers);
    return this;
  }

  withBody(body: any): this {
    this.definition.response.body = body;
    return this;
  }

  withDelay(ms: number): this {
    this.definition.response.delay = ms;
    return this;
  }

  withBodyFromFile(path: string): this {
    const content = readFileSync(path, 'utf-8');
    this.definition.response.body = JSON.parse(content);
    return this;
  }

  build(): MockDefinition {
    return this.definition;
  }
}
