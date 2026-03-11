import { readFileSync } from 'node:fs';
import type { FaultType, RemoteOverrideRequest, RemoteResponseSpec } from '../core/types.js';
import type { RemoteMockServer } from './remote-mock-server.js';
import type { RemoteMockRecord } from './remote-mock-server.js';

export class RemoteResponseBuilder {
  private activeResponse: RemoteResponseSpec;
  private appliedId?: string;

  constructor(
    private client: RemoteMockServer,
    private request: RemoteOverrideRequest,
    activeResponse?: RemoteResponseSpec,
  ) {
    this.activeResponse = activeResponse ?? request.response;
  }

  withHeaders(headers: Record<string, string>): this {
    this.activeResponse.headers = {
      ...(this.activeResponse.headers || {}),
      ...headers,
    };
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
    this.request.count = Math.max(0, Math.floor(count));
    return this;
  }

  persist(): this {
    this.request.count = 0;
    return this;
  }

  optionally(): this {
    this.request.optional = true;
    return this;
  }

  thenReply(status: number): RemoteResponseBuilder {
    const response: RemoteResponseSpec = { status };
    if (!this.request.sequence) {
      this.request.sequence = [];
    }
    this.request.sequence.push(response);
    return new RemoteResponseBuilder(this.client, this.request, response);
  }

  replySequence(...statuses: number[]): RemoteResponseBuilder {
    let builder: RemoteResponseBuilder = this;
    for (const status of statuses) {
      builder = builder.thenReply(status);
    }
    return builder;
  }

  withStatus(status: number): this {
    this.activeResponse.status = status;
    return this;
  }

  build(): RemoteOverrideRequest {
    return structuredClone(this.request);
  }

  async apply(): Promise<RemoteMockRecord> {
    const created = await this.client.createOverride(this.request);
    this.appliedId = created.id;
    return created;
  }

  async isInvoked(): Promise<boolean> {
    if (!this.appliedId) return false;
    const explanation = await this.client.explainVerification(this.request.path, { id: this.appliedId });
    return explanation.totalCallCount > 0;
  }
}
