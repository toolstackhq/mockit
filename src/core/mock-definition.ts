import { randomUUID } from 'node:crypto';
import type { MockDefinitionData, HttpMethod, MockPriority, MockResponse, Matcher, BodyMatcher, RecordedRequest } from './types.js';

export class MockDefinition implements MockDefinitionData {
  id: string;
  path: string;
  method?: HttpMethod;
  priority: MockPriority;
  headerMatchers: Map<string, Matcher<string>>;
  cookieMatchers: Map<string, Matcher<string>>;
  queryMatchers: Map<string, Matcher<string>>;
  bodyMatchers: BodyMatcher[];
  response: MockResponse;
  responseSequence: MockResponse[];
  callCount: number;
  calls: RecordedRequest[];
  optional: boolean;
  persisted: boolean;
  remainingUses?: number;
  private responseCursor: number;

  constructor(path: string, priority: MockPriority = 'override') {
    this.id = randomUUID();
    this.path = path;
    this.priority = priority;
    this.headerMatchers = new Map();
    this.cookieMatchers = new Map();
    this.queryMatchers = new Map();
    this.bodyMatchers = [];
    this.response = { status: 200, headers: {}, body: null };
    this.responseSequence = [];
    this.callCount = 0;
    this.calls = [];
    this.optional = false;
    this.persisted = false;
    this.remainingUses = undefined;
    this.responseCursor = 0;
  }

  recordCall(request: RecordedRequest): void {
    this.callCount++;
    this.calls.push(request);
    if (this.remainingUses !== undefined && this.remainingUses > 0) {
      this.remainingUses--;
    }
  }

  isInvoked(): boolean {
    return this.callCount > 0;
  }

  isExhausted(): boolean {
    return this.remainingUses !== undefined && this.remainingUses <= 0;
  }

  isPending(): boolean {
    return !this.optional && this.remainingUses !== undefined && this.remainingUses > 0;
  }

  nextResponse(): MockResponse {
    const responses = [this.response, ...this.responseSequence];
    const index = Math.min(this.responseCursor, responses.length - 1);
    if (this.responseCursor < responses.length - 1) {
      this.responseCursor++;
    }
    return responses[index];
  }

  addSequenceResponse(response: MockResponse): void {
    this.responseSequence.push(response);
  }

  get matcherCount(): number {
    return this.headerMatchers.size
      + this.cookieMatchers.size
      + this.queryMatchers.size
      + this.bodyMatchers.length
      + (this.method ? 1 : 0);
  }
}
