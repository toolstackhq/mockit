import { readFileSync } from 'node:fs';
import { MockDefinition } from '../core/mock-definition.js';
import type { FaultType } from '../core/types.js';

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

  withRandomDelay(min: number, max: number): this {
    this.definition.response.delayRange = { min, max };
    return this;
  }

  withFault(fault: FaultType): this {
    this.definition.response.fault = fault;
    return this;
  }

  withBodyTemplate(template: any): this {
    this.definition.response.body = template;
    this.definition.response.template = true;
    return this;
  }

  withBodyFromFile(path: string): this {
    const content = readFileSync(path, 'utf-8');
    this.definition.response.body = JSON.parse(content);
    return this;
  }

  isInvoked(): boolean {
    return this.definition.isInvoked();
  }

  build(): MockDefinition {
    return this.definition;
  }
}
