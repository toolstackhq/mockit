import { readFileSync } from 'node:fs';
import { MockDefinition } from '../core/mock-definition.js';
import type { FaultType, MockResponse } from '../core/types.js';

export class ResponseBuilder {
  private activeResponse: MockResponse;

  constructor(private definition: MockDefinition, activeResponse?: MockResponse) {
    this.activeResponse = activeResponse ?? definition.response;
  }

  withHeaders(headers: Record<string, string>): this {
    Object.assign(this.activeResponse.headers, headers);
    return this;
  }

  withBody(body: any): this {
    this.activeResponse.body = body;
    return this;
  }

  withDelay(ms: number): this {
    this.activeResponse.delay = ms;
    return this;
  }

  withRandomDelay(min: number, max: number): this {
    this.activeResponse.delayRange = { min, max };
    return this;
  }

  withFault(fault: FaultType): this {
    this.activeResponse.fault = fault;
    return this;
  }

  withBodyTemplate(template: any): this {
    this.activeResponse.body = template;
    this.activeResponse.template = true;
    return this;
  }

  withBodyFromFile(path: string): this {
    const content = readFileSync(path, 'utf-8');
    this.activeResponse.body = JSON.parse(content);
    return this;
  }

  once(): this {
    return this.times(1);
  }

  times(count: number): this {
    this.definition.persisted = false;
    this.definition.remainingUses = Math.max(0, Math.floor(count));
    return this;
  }

  persist(): this {
    this.definition.persisted = true;
    this.definition.remainingUses = undefined;
    return this;
  }

  optionally(): this {
    this.definition.optional = true;
    return this;
  }

  thenReply(status: number): ResponseBuilder {
    const response: MockResponse = { status, headers: {}, body: null };
    this.definition.addSequenceResponse(response);
    return new ResponseBuilder(this.definition, response);
  }

  replySequence(...statuses: number[]): ResponseBuilder {
    let builder: ResponseBuilder = this;
    for (const status of statuses) {
      builder = builder.thenReply(status);
    }
    return builder;
  }

  withStatus(status: number): this {
    this.activeResponse.status = status;
    return this;
  }

  isInvoked(): boolean {
    return this.definition.isInvoked();
  }

  build(): MockDefinition {
    return this.definition;
  }
}
